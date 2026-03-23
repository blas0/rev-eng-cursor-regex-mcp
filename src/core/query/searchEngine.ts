import path from "node:path";
import { promises as fs } from "node:fs";
import { createQueryPlan } from "./anchorExtraction.js";
import { buildCoveringSparseTerms } from "./sparseCovering.js";
import { decodePostings } from "../index/postings.js";
import { findLookupRecords } from "../index/lookupTable.js";
import { loadActiveIndexBundle } from "../index/loader.js";
import { mergeActiveDocs } from "../index/overlay.js";
import {
  DEFAULT_CONTEXT_LINES,
  DEFAULT_MAX_RESULTS,
  LiteralSearchRequest,
  QueryPlan,
  RegexSearchRequest,
  SearchExecutionResult,
  SearchMatch,
} from "../shared/types.js";
import { hash64Hex, toSafeId } from "../shared/hashing.js";
import { resolveToolOptions } from "../shared/paths.js";
import { ensureIndex } from "../index/manager.js";
import { matchesAnyGlob } from "../shared/globs.js";
import { RegextoolError } from "../shared/errors.js";

function intersectSets(left: Set<string>, right: Set<string>): Set<string> {
  if (left.size === 0 || right.size === 0) {
    return new Set<string>();
  }

  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  return new Set([...small].filter((value) => large.has(value)));
}

function unionSets(sets: Set<string>[]): Set<string> {
  const result = new Set<string>();
  for (const set of sets) {
    for (const value of set) {
      result.add(value);
    }
  }
  return result;
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function filterPathSet(paths: Set<string>, globs: string[]): Set<string> {
  if (globs.length === 0) {
    return paths;
  }

  return new Set(
    [...paths].filter((relativePath) =>
      matchesAnyGlob(normalizeRelativePath(relativePath), globs),
    ),
  );
}

function getLineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
}

function lineAndColumn(lineStarts: number[], index: number): { line: number; column: number } {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index && (mid === lineStarts.length - 1 || lineStarts[mid + 1] > index)) {
      return {
        line: mid + 1,
        column: index - lineStarts[mid] + 1,
      };
    }
    if (lineStarts[mid] > index) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return { line: 1, column: index + 1 };
}

function sliceContext(
  lines: string[],
  startLine: number,
  endLine: number,
  beforeLines: number,
  afterLines: number,
): { before: string[]; current: string; after: string[] } {
  const current = lines[startLine - 1] ?? "";
  return {
    before: lines.slice(Math.max(0, startLine - beforeLines - 1), startLine - 1),
    current,
    after: lines.slice(endLine, Math.min(lines.length, endLine + afterLines)),
  };
}

function buildMatchesForRegex(
  options: {
    text: string;
    pattern: string;
    flags: string;
    maxResults: number;
    beforeLines: number;
    afterLines: number;
    relativePath: string;
    absolutePath: string;
  },
): SearchMatch[] {
  const flags = options.flags.includes("g") ? options.flags : `${options.flags}g`;
  const regex = new RegExp(options.pattern, flags);
  const lineStarts = getLineStarts(options.text);
  const lines = options.text.split(/\r?\n/);
  const matches: SearchMatch[] = [];

  while (matches.length < options.maxResults) {
    const match = regex.exec(options.text);
    if (!match) {
      break;
    }

    const startIndex = match.index;
    const matchText = match[0] ?? "";
    const endIndex = startIndex + matchText.length;
    const start = lineAndColumn(lineStarts, startIndex);
    const end = lineAndColumn(lineStarts, Math.max(startIndex, endIndex - 1));
    const context = sliceContext(
      lines,
      start.line,
      end.line,
      options.beforeLines,
      options.afterLines,
    );

    matches.push({
      path: options.relativePath,
      absolutePath: options.absolutePath,
      line: start.line,
      column: start.column,
      endLine: end.line,
      endColumn: end.column,
      matchText,
      contextBefore: context.before,
      contextLine: context.current,
      contextAfter: context.after,
    });

    if (matchText.length === 0) {
      regex.lastIndex += 1;
    }
  }

  return matches;
}

async function getCandidatePathsForTerm(options: {
  workspaceRoot: string;
  bundle: NonNullable<Awaited<ReturnType<typeof loadActiveIndexBundle>>>;
  term: string;
}): Promise<Set<string>> {
  const hashHex = await hash64Hex(options.term);
  const baseRecords = findLookupRecords(options.bundle.lookup, hashHex);
  const overlayRecords = findLookupRecords(options.bundle.overlayLookup, hashHex);

  const result = new Set<string>();
  for (const record of baseRecords) {
    const slice = options.bundle.postings.subarray(record.offset, record.offset + record.length);
    const postings = decodePostings(slice);
    for (const posting of postings) {
      const doc = options.bundle.docs[posting.docId];
      if (!doc) {
        continue;
      }
      if (options.bundle.deletedPaths.has(doc.relativePath)) {
        continue;
      }
      if (options.bundle.replacedPaths.has(doc.relativePath)) {
        continue;
      }
      result.add(doc.relativePath);
    }
  }

  for (const record of overlayRecords) {
    const slice = options.bundle.overlayPostings.subarray(
      record.offset,
      record.offset + record.length,
    );
    const postings = decodePostings(slice);
    for (const posting of postings) {
      const doc = options.bundle.overlayDocs[posting.docId];
      if (doc) {
        result.add(doc.relativePath);
      }
    }
  }

  return result;
}

async function getCandidatePathsForAnchor(options: {
  bundle: NonNullable<Awaited<ReturnType<typeof loadActiveIndexBundle>>>;
  termSource: string;
}): Promise<Set<string>> {
  const covering = buildCoveringSparseTerms(options.termSource);
  if (covering.length === 0) {
    return new Set<string>();
  }

  let current: Set<string> | null = null;
  for (const term of covering) {
    const docs = await getCandidatePathsForTerm({
      workspaceRoot: "",
      bundle: options.bundle,
      term: term.term,
    });
    current = current === null ? docs : intersectSets(current, docs);
    if (current.size === 0) {
      break;
    }
  }

  return current ?? new Set<string>();
}

async function loadText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

function activeDocsForBundle(bundle: NonNullable<Awaited<ReturnType<typeof loadActiveIndexBundle>>>) {
  return mergeActiveDocs({
    baseDocs: bundle.docs,
    overlayDocs: bundle.overlayDocs,
    deletedPaths: bundle.deletedPaths,
  });
}

async function loadBundleWithAutoEnsure(options: {
  workspaceRoot?: string;
  indexDir?: string;
  autoEnsure?: boolean;
}): Promise<{
  workspaceRoot: string;
  indexDir: string;
  bundle: NonNullable<Awaited<ReturnType<typeof loadActiveIndexBundle>>>;
}> {
  const toolOptions = resolveToolOptions(options);
  const workspaceId = toSafeId("ws", toolOptions.workspaceRoot);

  if (options.autoEnsure ?? true) {
    await ensureIndex({
      workspaceRoot: toolOptions.workspaceRoot,
      indexDir: toolOptions.indexDir,
      refreshOverlay: true,
    });
  }

  const bundle = await loadActiveIndexBundle(toolOptions.indexDir, workspaceId);
  if (!bundle) {
    throw new RegextoolError(
      "INDEX_NOT_READY",
      "No active index exists for this workspace. Call `index.ensure` first.",
    );
  }

  return {
    workspaceRoot: toolOptions.workspaceRoot,
    indexDir: toolOptions.indexDir,
    bundle,
  };
}

/**
 * Execute an indexed literal search.
 */
export async function runLiteralSearch(
  request: LiteralSearchRequest,
): Promise<SearchExecutionResult> {
  const startedAt = Date.now();
  const { bundle } = await loadBundleWithAutoEnsure({
    workspaceRoot: request.workspaceRoot,
    indexDir: request.indexDir,
    autoEnsure: request.autoEnsureIndex,
  });

  const maxResults = request.maxResults ?? DEFAULT_MAX_RESULTS;
  const beforeLines = request.beforeLines ?? DEFAULT_CONTEXT_LINES;
  const afterLines = request.afterLines ?? DEFAULT_CONTEXT_LINES;
  const allDocs = activeDocsForBundle(bundle);

  let candidatePaths = new Set(allDocs.keys());
  if (request.caseSensitive !== false && request.needle.length >= 2) {
    const indexedCandidates = await getCandidatePathsForAnchor({
      bundle,
      termSource: request.needle,
    });
    candidatePaths = indexedCandidates;
  }

  candidatePaths = filterPathSet(candidatePaths, request.pathGlobs ?? []);
  const matches: SearchMatch[] = [];
  let scannedDocCount = 0;
  for (const relativePath of [...candidatePaths].sort()) {
    const doc = allDocs.get(relativePath);
    if (!doc) {
      continue;
    }
    scannedDocCount += 1;
    const text = await loadText(doc.absolutePath);
    const haystack = request.caseSensitive === false ? text.toLowerCase() : text;
    const needle = request.caseSensitive === false ? request.needle.toLowerCase() : request.needle;
    let index = haystack.indexOf(needle);
    while (index !== -1 && matches.length < maxResults) {
      const lineStarts = getLineStarts(text);
      const lines = text.split(/\r?\n/);
      const start = lineAndColumn(lineStarts, index);
      const end = lineAndColumn(lineStarts, index + needle.length - 1);
      const context = sliceContext(lines, start.line, end.line, beforeLines, afterLines);
      matches.push({
        path: relativePath,
        absolutePath: doc.absolutePath,
        line: start.line,
        column: start.column,
        endLine: end.line,
        endColumn: end.column,
        matchText: text.slice(index, index + needle.length),
        contextBefore: context.before,
        contextLine: context.current,
        contextAfter: context.after,
      });
      index = haystack.indexOf(needle, index + Math.max(needle.length, 1));
    }
    if (matches.length >= maxResults) {
      break;
    }
  }

  return {
    queryKind: "literal",
    candidateDocCount: candidatePaths.size,
    scannedDocCount,
    matchCount: matches.length,
    truncated: matches.length >= maxResults,
    elapsedMs: Date.now() - startedAt,
    matches,
  };
}

/**
 * Execute an indexed regex search with sparse covering or a deterministic full-scan fallback.
 */
export async function runRegexSearch(
  request: RegexSearchRequest,
): Promise<SearchExecutionResult & { plan?: QueryPlan }> {
  const startedAt = Date.now();
  const { bundle } = await loadBundleWithAutoEnsure({
    workspaceRoot: request.workspaceRoot,
    indexDir: request.indexDir,
    autoEnsure: request.autoEnsureIndex,
  });

  const plan = createQueryPlan(request.pattern, request.flags ?? "");
  const maxResults = request.maxResults ?? DEFAULT_MAX_RESULTS;
  const beforeLines = request.beforeLines ?? DEFAULT_CONTEXT_LINES;
  const afterLines = request.afterLines ?? DEFAULT_CONTEXT_LINES;
  const allDocs = activeDocsForBundle(bundle);

  let candidatePaths = new Set(allDocs.keys());
  if (!plan.requiresFullScan) {
    const branchCandidates: Set<string>[] = [];
    for (const branch of plan.branchAnchors) {
      const anchors = branch.filter((anchor) => anchor.length >= 2);
      if (anchors.length === 0) {
        continue;
      }

      let branchSet: Set<string> | null = null;
      for (const anchor of anchors) {
        const anchorSet = await getCandidatePathsForAnchor({
          bundle,
          termSource: anchor,
        });
        branchSet = branchSet === null ? anchorSet : intersectSets(branchSet, anchorSet);
      }
      if (branchSet !== null) {
        branchCandidates.push(branchSet);
      }
    }
    if (branchCandidates.length > 0) {
      candidatePaths = unionSets(branchCandidates);
    }
  }

  candidatePaths = filterPathSet(candidatePaths, request.pathGlobs ?? []);
  const matches: SearchMatch[] = [];
  let scannedDocCount = 0;
  for (const relativePath of [...candidatePaths].sort()) {
    const doc = allDocs.get(relativePath);
    if (!doc) {
      continue;
    }

    scannedDocCount += 1;
    const text = await loadText(doc.absolutePath);
    const docMatches = buildMatchesForRegex({
      text,
      pattern: request.pattern,
      flags: request.flags ?? "",
      maxResults: maxResults - matches.length,
      beforeLines,
      afterLines,
      relativePath,
      absolutePath: doc.absolutePath,
    });
    matches.push(...docMatches);
    if (matches.length >= maxResults) {
      break;
    }
  }

  const result: SearchExecutionResult & { plan?: QueryPlan } = {
    queryKind: "regex",
    candidateDocCount: candidatePaths.size,
    scannedDocCount,
    matchCount: matches.length,
    truncated: matches.length >= maxResults,
    elapsedMs: Date.now() - startedAt,
    matches,
    plannerMode: plan.plannerMode,
    extractableAnchors: plan.extractableAnchors,
    coveringGramCount: plan.sparseCoveringTerms.length,
    fallbackReason: plan.fallbackReason,
  };

  if (request.includePlan) {
    result.plan = plan;
  }

  return result;
}
