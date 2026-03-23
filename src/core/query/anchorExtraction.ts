import {
  AST,
} from "@eslint-community/regexpp";
import {
  DEFAULT_MAX_BRANCH_ANCHORS,
  DEFAULT_MAX_CLASS_EXPANSION,
  PlannerMode,
  QueryPlan,
} from "../shared/types.js";
import { buildCoveringSparseTerms } from "./sparseCovering.js";
import { parseRegex, ParsedRegex, expandSmallCharacterClass } from "./regexParse.js";
import { getTrigrams } from "./trigramExplain.js";

interface EnumerationResult {
  strings: string[] | null;
  skipped: string[];
}

interface BranchResult {
  anchors: string[];
  skipped: string[];
  exactLiterals: string[] | null;
}

function appendCartesian(left: string[], right: string[]): string[] | null {
  const result: string[] = [];
  for (const lhs of left) {
    for (const rhs of right) {
      result.push(lhs + rhs);
      if (result.length > DEFAULT_MAX_BRANCH_ANCHORS) {
        return null;
      }
    }
  }
  return result;
}

function enumerateAlternativeExact(alternative: AST.Alternative): EnumerationResult {
  let current = [""];
  const skipped: string[] = [];

  for (const element of alternative.elements) {
    const elementResult = enumerateElementExact(element);
    skipped.push(...elementResult.skipped);
    if (elementResult.strings === null) {
      return { strings: null, skipped };
    }

    const next = appendCartesian(current, elementResult.strings);
    if (next === null) {
      skipped.push("branch-expansion-cap");
      return { strings: null, skipped };
    }

    current = next;
  }

  return { strings: current, skipped };
}

function enumerateGroupExact(node: AST.Group | AST.CapturingGroup): EnumerationResult {
  const skipped: string[] = [];
  const expanded: string[] = [];

  for (const alternative of node.alternatives) {
    const result = enumerateAlternativeExact(alternative);
    skipped.push(...result.skipped);
    if (result.strings === null) {
      return { strings: null, skipped };
    }
    expanded.push(...result.strings);
    if (expanded.length > DEFAULT_MAX_BRANCH_ANCHORS) {
      skipped.push("branch-expansion-cap");
      return { strings: null, skipped };
    }
  }

  return { strings: [...new Set(expanded)], skipped };
}

function enumerateQuantifierExact(node: AST.Quantifier): EnumerationResult {
  if (node.min !== node.max || node.min > 4) {
    return { strings: null, skipped: ["complex-quantifier"] };
  }

  const inner = enumerateElementExact(node.element);
  if (inner.strings === null) {
    return inner;
  }

  let values = [""];
  for (let count = 0; count < node.min; count += 1) {
    const next = appendCartesian(values, inner.strings);
    if (next === null) {
      return { strings: null, skipped: [...inner.skipped, "branch-expansion-cap"] };
    }
    values = next;
  }
  return { strings: values, skipped: inner.skipped };
}

function enumerateElementExact(element: AST.Alternative["elements"][number]): EnumerationResult {
  switch (element.type) {
    case "Character":
      return { strings: [String.fromCodePoint(element.value)], skipped: [] };
    case "CharacterClass": {
      const expanded = expandSmallCharacterClass(
        element as AST.CharacterClass,
        DEFAULT_MAX_CLASS_EXPANSION,
      );
      return expanded === null
        ? { strings: null, skipped: ["broad-character-class"] }
        : { strings: expanded, skipped: [] };
    }
    case "CharacterSet":
      return { strings: null, skipped: ["character-set"] };
    case "Backreference":
      return { strings: null, skipped: ["backreference"] };
    case "Assertion":
      if (element.kind === "lookahead" || element.kind === "lookbehind") {
        return { strings: null, skipped: ["lookaround"] };
      }
      return { strings: [""], skipped: [] };
    case "Quantifier":
      return enumerateQuantifierExact(element as AST.Quantifier);
    case "Group":
      return enumerateGroupExact(element as AST.Group);
    case "CapturingGroup":
      return enumerateGroupExact(element as AST.CapturingGroup);
    default:
      return { strings: null, skipped: [`unsupported-${element.type}`] };
  }
}

function collectAnchorsFromAlternative(alternative: AST.Alternative): BranchResult {
  const anchors: string[] = [];
  const skipped: string[] = [];
  let current = [""];

  function flushCurrent() {
    for (const value of current) {
      if (value.length >= 2) {
        anchors.push(value);
      }
    }
    current = [""];
  }

  for (const element of alternative.elements) {
    const exact = enumerateElementExact(element);
    skipped.push(...exact.skipped);
    if (exact.strings !== null) {
      const next = appendCartesian(current, exact.strings);
      if (next !== null) {
        current = next;
        continue;
      }
      skipped.push("branch-expansion-cap");
    }

    flushCurrent();
    if (element.type === "Group" || element.type === "CapturingGroup") {
      for (const nested of element.alternatives) {
        const nestedResult = collectAnchorsFromAlternative(nested);
        anchors.push(...nestedResult.anchors);
        skipped.push(...nestedResult.skipped);
      }
      continue;
    }
  }

  flushCurrent();
  const exactLiterals = enumerateAlternativeExact(alternative);
  skipped.push(...exactLiterals.skipped);
  return {
    anchors: [...new Set(anchors)].sort((left, right) => right.length - left.length),
    skipped,
    exactLiterals: exactLiterals.strings,
  };
}

function normalizedPatternString(parsed: ParsedRegex): string {
  return `/${parsed.pattern}/${parsed.flags}`;
}

function choosePlannerMode(
  branchAnchors: string[][],
  requiresFullScan: boolean,
): PlannerMode {
  if (requiresFullScan) {
    return "full-scan-fallback";
  }
  return branchAnchors.length > 1 ? "branch-covering" : "literal-covering";
}

/**
 * Explain how a regex query will be decomposed before it reaches the index.
 */
export function createQueryPlan(pattern: string, flags = ""): QueryPlan {
  const parsed = parseRegex(pattern, flags);
  const branchResults = parsed.ast.alternatives.map(collectAnchorsFromAlternative);
  const branchAnchors = branchResults.map((result) => result.anchors.slice(0, DEFAULT_MAX_BRANCH_ANCHORS));
  const extractableAnchors = [...new Set(branchAnchors.flat())];
  const skippedConstructs = [...new Set(branchResults.flatMap((result) => result.skipped))];
  const exactLiteralBranches = branchResults
    .map((result) => result.exactLiterals)
    .filter((result): result is string[] => Array.isArray(result));
  const exactSingleLiteral =
    exactLiteralBranches.length === 1 && exactLiteralBranches[0].length === 1
      ? exactLiteralBranches[0][0]
      : null;

  let fallbackReason: string | undefined;
  if (flags.includes("i")) {
    fallbackReason = "Ignore-case matching cannot safely use the case-sensitive sparse index.";
  } else if (extractableAnchors.length === 0) {
    fallbackReason = "No literal anchors could be extracted from the pattern.";
  }

  const requiresFullScan = fallbackReason !== undefined;
  const plannerMode = choosePlannerMode(branchAnchors, requiresFullScan);
  const classicTrigrams = [...new Set(extractableAnchors.flatMap((anchor) => getTrigrams(anchor).map((term) => term.term)))];
  const sparseCoveringTerms = [
    ...new Set(
      extractableAnchors.flatMap((anchor) =>
        buildCoveringSparseTerms(anchor).map((term) => term.term),
      ),
    ),
  ];

  return {
    valid: true,
    normalizedPattern: normalizedPatternString(parsed),
    alternationBranches: parsed.ast.alternatives.length,
    extractableAnchors,
    classicTrigrams,
    sparseCoveringTerms,
    skippedConstructs,
    requiresFullScan,
    recommendedTool:
      exactSingleLiteral !== null && (flags === "" || flags === "i")
        ? "search.literal"
        : "search.regex",
    plannerMode,
    fallbackReason,
    branchAnchors,
  };
}
