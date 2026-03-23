export const INDEX_VERSION = 1;
export const DEFAULT_MAX_RESULTS = 100;
export const DEFAULT_CONTEXT_LINES = 1;
export const DEFAULT_MAX_TERM_LENGTH = 24;
export const DEFAULT_MAX_CLASS_EXPANSION = 8;
export const DEFAULT_MAX_BRANCH_ANCHORS = 8;
export const LOOKUP_RECORD_SIZE = 16;

export type SourceMode = "git" | "snapshot";
export type InspectMode = "sparse" | "trigram" | "masked-trigram";
export type PlannerMode =
  | "literal-covering"
  | "branch-covering"
  | "full-scan-fallback";

export interface RuntimeConfig {
  workspaceRoot: string;
  indexDir: string;
  httpHost: string;
  httpPort: number;
}

export interface ResolvedToolOptions {
  workspaceRoot: string;
  indexDir: string;
}

export interface CorpusFile {
  relativePath: string;
  absolutePath: string;
  content: string;
  contentHash: string;
  size: number;
  mtimeMs: number;
  tracked: boolean;
}

export interface DocRecord {
  docId: number;
  relativePath: string;
  absolutePath: string;
  size: number;
  mtimeMs: number;
  contentHash: string;
  tracked: boolean;
  source: "base" | "overlay";
}

export interface EncodedPosting {
  docId: number;
  positions: number[];
}

export interface LookupRecord {
  hashHex: string;
  offset: number;
  length: number;
}

export interface OverlaySummary {
  revision: string;
  fileCount: number;
  deletedPaths: string[];
  changedPaths: string[];
  builtAt: string;
  byteSize: number;
}

export interface IndexManifest {
  version: number;
  workspaceRoot: string;
  workspaceId: string;
  sourceMode: SourceMode;
  sourceRevision: string;
  baseIndexId: string;
  createdAt: string;
  includeGlobs: string[];
  excludeGlobs: string[];
  fileCount: number;
  byteSize: number;
  overlay: OverlaySummary;
}

export interface CurrentIndexPointer {
  workspaceId: string;
  workspaceRoot: string;
  sourceMode: SourceMode;
  sourceRevision: string;
  baseIndexId: string;
  includeGlobs: string[];
  excludeGlobs: string[];
  updatedAt: string;
}

export interface IndexBuildResult {
  manifest: IndexManifest;
  workspaceRoot: string;
  workspaceId: string;
  storageDir: string;
  trackedFileCount: number;
  overlayFileCount: number;
}

export interface SearchMatch {
  path: string;
  absolutePath: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  matchText: string;
  contextBefore: string[];
  contextLine: string;
  contextAfter: string[];
}

export interface SearchExecutionResult {
  queryKind: "literal" | "regex";
  candidateDocCount: number;
  scannedDocCount: number;
  matchCount: number;
  truncated: boolean;
  elapsedMs: number;
  matches: SearchMatch[];
  plannerMode?: PlannerMode;
  extractableAnchors?: string[];
  coveringGramCount?: number;
  fallbackReason?: string;
}

export interface SearchRequest {
  workspaceRoot?: string;
  indexDir?: string;
  pathGlobs?: string[];
  maxResults?: number;
  beforeLines?: number;
  afterLines?: number;
  autoEnsureIndex?: boolean;
}

export interface LiteralSearchRequest extends SearchRequest {
  needle: string;
  caseSensitive?: boolean;
}

export interface RegexSearchRequest extends SearchRequest {
  pattern: string;
  flags?: string;
  includePlan?: boolean;
}

export interface QueryPlan {
  valid: boolean;
  normalizedPattern: string;
  alternationBranches: number;
  extractableAnchors: string[];
  classicTrigrams: string[];
  sparseCoveringTerms: string[];
  skippedConstructs: string[];
  requiresFullScan: boolean;
  recommendedTool: "search.literal" | "search.regex";
  plannerMode: PlannerMode;
  fallbackReason?: string;
  branchAnchors: string[][];
}

export interface InspectTerm {
  term: string;
  start: number;
  end: number;
  weight?: number;
  nextMask?: string;
  locMask?: string;
}

export interface InspectTermsResult {
  mode: InspectMode;
  termCount: number;
  terms: InspectTerm[];
  notes: string[];
}

export interface CorpusSelectionOptions {
  workspaceRoot: string;
  includeGlobs: string[];
  excludeGlobs: string[];
}

export interface EnsureIndexOptions {
  workspaceRoot?: string;
  indexDir?: string;
  forceRebuild?: boolean;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  refreshOverlay?: boolean;
}

export interface LoadedIndexBundle {
  manifest: IndexManifest;
  docs: DocRecord[];
  overlayDocs: DocRecord[];
  deletedPaths: Set<string>;
  replacedPaths: Set<string>;
  lookup: Buffer;
  postings: Buffer;
  overlayLookup: Buffer;
  overlayPostings: Buffer;
}
