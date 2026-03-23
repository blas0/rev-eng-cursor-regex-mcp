import { getIndexStatus } from "../index/manager.js";
import {
  QueryPlan,
  SearchIntent,
  SearchPlanRequest,
  SearchPlanResponse,
  SearchWorkflowTool,
} from "../shared/types.js";
import { createQueryPlan } from "./anchorExtraction.js";

const QUOTED_VALUE = /`([^`]+)`|"([^"\n]+)"|'([^'\n]+)'/g;
const IDENTIFIER_VALUE = /\b[A-Za-z_][A-Za-z0-9_./:-]{2,}\b/g;
const OBJECTIVE_EXACT_HINT = /\b(exact|literal|string|identifier|constant|token|env|occurrence|find where)\b/i;
const OBJECTIVE_REGEX_HINT = /\b(regex|pattern|matches|matching|wildcard|character class|alternation)\b/i;
const CASE_INSENSITIVE_HINT = /\b(ignore[- ]case|case[- ]insensitive)\b/i;
const STOP_WORDS = new Set([
  "find",
  "where",
  "this",
  "that",
  "with",
  "from",
  "into",
  "repo",
  "code",
  "search",
  "regex",
  "pattern",
  "match",
  "matches",
  "string",
  "exact",
  "literal",
  "token",
  "path",
  "paths",
  "file",
  "files",
]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function normalizePathHints(pathHints: string[] | undefined): string[] | undefined {
  const normalized = unique(pathHints ?? []);
  return normalized.length > 0 ? normalized : undefined;
}

function looksLikeRegexPattern(value: string): boolean {
  return /\\[dDsSwWbB]|[\[\]()|+*?{}]/.test(value);
}

function mentionsRegexIntent(objective: string): boolean {
  return OBJECTIVE_REGEX_HINT.test(objective);
}

function mentionsExactIntent(objective: string): boolean {
  return OBJECTIVE_EXACT_HINT.test(objective);
}

function extractQuotedValues(objective: string): string[] {
  const matches: string[] = [];
  for (const match of objective.matchAll(QUOTED_VALUE)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value) {
      matches.push(value);
    }
  }
  return unique(matches);
}

function extractIdentifierValues(objective: string): string[] {
  const matches: string[] = [];
  for (const match of objective.matchAll(IDENTIFIER_VALUE)) {
    const value = match[0];
    if (
      value &&
      !STOP_WORDS.has(value.toLowerCase()) &&
      (/[A-Z_]/.test(value) || /[./:-]/.test(value))
    ) {
      matches.push(value);
    }
  }
  return unique(matches);
}

function inferExactCandidate(objective: string): string | undefined {
  const quoted = extractQuotedValues(objective).filter((value) => !looksLikeRegexPattern(value));
  if (quoted.length > 0) {
    return quoted[0];
  }

  const identifiers = extractIdentifierValues(objective).filter(
    (value) => !looksLikeRegexPattern(value),
  );
  if (identifiers.length > 0) {
    return identifiers.sort((left, right) => right.length - left.length)[0];
  }

  return undefined;
}

function inferRegexCandidate(objective: string): string | undefined {
  const quoted = extractQuotedValues(objective);
  const explicitRegex = quoted.find(looksLikeRegexPattern);
  if (explicitRegex) {
    return explicitRegex;
  }

  if (mentionsRegexIntent(objective)) {
    return quoted[0] ?? extractIdentifierValues(objective)[0];
  }

  return undefined;
}

function resolveIntent(
  objective: string,
  suspectedPattern: string | undefined,
  knownExactString: string | undefined,
): SearchIntent {
  if (knownExactString) {
    return "exact-string";
  }
  if (suspectedPattern) {
    return looksLikeRegexPattern(suspectedPattern) ? "regex" : "exact-string";
  }
  if (mentionsRegexIntent(objective)) {
    return "regex";
  }
  if (mentionsExactIntent(objective) || inferExactCandidate(objective)) {
    return "exact-string";
  }
  return "unknown";
}

function prependEnsure(
  mustEnsureIndex: boolean,
  sequence: SearchWorkflowTool[],
): SearchWorkflowTool[] {
  return mustEnsureIndex ? ["index.ensure", ...sequence] : sequence;
}

function needsExplain(plan: QueryPlan): boolean {
  if (plan.requiresFullScan) {
    return true;
  }
  if (plan.extractableAnchors.length === 0) {
    return true;
  }
  return plan.extractableAnchors.every((anchor) => anchor.length < 3);
}

function buildFallbackPlan(pathGlobs: string[] | undefined): string[] {
  const plan = [
    "If the first search is too broad, narrow the pattern before retrying.",
    "Prefer `pathGlobs` to scope the search to likely subsystems or folders.",
    "Switch to `search.literal` as soon as an exact identifier or string is known.",
    "Use `document.inspect_terms` only to debug tokenization or weak sparse planning.",
    "Use shell `rg` or `grep` only after MCP search results are insufficient or the task is an exact known-path lookup.",
  ];

  if (pathGlobs && pathGlobs.length > 0) {
    plan.unshift(`Start with path scope: ${pathGlobs.join(", ")}.`);
  }

  return plan;
}

/**
 * Build a deterministic workflow recommendation for search-related agent tasks.
 */
export async function buildSearchPlan(
  request: SearchPlanRequest,
): Promise<SearchPlanResponse> {
  const status = await getIndexStatus({
    workspaceRoot: request.workspaceRoot,
    indexDir: request.indexDir,
  });
  const mustEnsureIndex = !status.ready || status.stalePaths.length > 0;
  const pathGlobs = normalizePathHints(request.pathHints);
  const reasoning: string[] = [];
  const fallbackPlan = buildFallbackPlan(pathGlobs);
  const caseSensitive = CASE_INSENSITIVE_HINT.test(request.objective) ? false : undefined;

  if (!status.ready) {
    reasoning.push("No active index exists for this workspace, so the workflow must start with `index.ensure`.");
  } else if (status.stalePaths.length > 0) {
    reasoning.push(
      `The active index is stale for ${status.stalePaths.length} path(s), so ` +
        "`index.ensure` should refresh it before searching.",
    );
  }

  const intent = resolveIntent(
    request.objective,
    request.suspectedPattern,
    request.knownExactString,
  );

  const exactCandidate =
    request.knownExactString ??
    (request.suspectedPattern && !looksLikeRegexPattern(request.suspectedPattern)
      ? request.suspectedPattern
      : inferExactCandidate(request.objective));

  if (exactCandidate) {
    reasoning.push(
      `An exact candidate was identified (${JSON.stringify(exactCandidate)}), so literal search is the lowest-friction first step.`,
    );
    const recommendedSequence = prependEnsure(mustEnsureIndex, ["search.literal"]);
    return {
      mustEnsureIndex,
      recommendedFirstTool: recommendedSequence[0],
      recommendedSequence,
      suggestedLiteralArgs: {
        needle: exactCandidate,
        pathGlobs,
        caseSensitive,
      },
      reasoning,
      fallbackPlan,
    };
  }

  const regexCandidate =
    request.suspectedPattern ??
    inferRegexCandidate(request.objective);

  if (regexCandidate) {
    const plan = createQueryPlan(regexCandidate, "");
    const explainFirst = needsExplain(plan) || intent === "unknown";
    const sequence = explainFirst
      ? prependEnsure(mustEnsureIndex, ["query.explain", "search.regex"])
      : prependEnsure(mustEnsureIndex, ["search.regex"]);

    reasoning.push(
      explainFirst
        ? "The suspected pattern has weak or uncertain anchors, so `query.explain` should run before `search.regex`."
        : "The suspected pattern has usable anchors, so `search.regex` can run directly.",
    );
    if (pathGlobs && pathGlobs.length > 0) {
      reasoning.push("Path hints were propagated into `pathGlobs` to keep the search scoped.");
    }

    return {
      mustEnsureIndex,
      recommendedFirstTool: sequence[0],
      recommendedSequence: sequence,
      suggestedRegexArgs: {
        pattern: regexCandidate,
        pathGlobs,
      },
      suggestedExplainArgs: {
        pattern: regexCandidate,
      },
      reasoning,
      fallbackPlan,
    };
  }

  reasoning.push(
    "No exact string or regex candidate could be extracted confidently from the objective, so the plan defaults to a narrow literal search after indexing.",
  );
  const fallbackNeedle = request.objective.trim().split(/\s+/).find((token) => !STOP_WORDS.has(token.toLowerCase())) ?? request.objective.trim();
  const recommendedSequence = prependEnsure(mustEnsureIndex, ["search.literal"]);
  return {
    mustEnsureIndex,
    recommendedFirstTool: recommendedSequence[0],
    recommendedSequence,
    suggestedLiteralArgs: {
      needle: fallbackNeedle,
      pathGlobs,
      caseSensitive,
    },
    reasoning,
    fallbackPlan,
  };
}
