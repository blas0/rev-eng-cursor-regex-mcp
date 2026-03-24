import * as z from "zod/v4";

export const sourceModeSchema = z.enum(["git", "snapshot"]);
export const inspectModeSchema = z.enum(["sparse", "trigram", "masked-trigram"]);
export const plannerModeSchema = z.enum([
  "literal-covering",
  "branch-covering",
  "full-scan-fallback",
]);
export const searchWorkflowToolSchema = z.enum([
  "index.ensure",
  "search.literal",
  "query.explain",
  "search.regex",
]);

export const searchMatchSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  endLine: z.number().int().positive(),
  endColumn: z.number().int().positive(),
  matchText: z.string(),
  contextBefore: z.array(z.string()),
  contextLine: z.string(),
  contextAfter: z.array(z.string()),
});

export const queryPlanSchema = z.object({
  valid: z.boolean(),
  normalizedPattern: z.string(),
  alternationBranches: z.number().int().nonnegative(),
  extractableAnchors: z.array(z.string()),
  classicTrigrams: z.array(z.string()),
  sparseCoveringTerms: z.array(z.string()),
  skippedConstructs: z.array(z.string()),
  requiresFullScan: z.boolean(),
  recommendedTool: z.enum(["search.literal", "search.regex"]),
  plannerMode: plannerModeSchema,
  fallbackReason: z.string().optional(),
  branchAnchors: z.array(z.array(z.string())),
});

export const searchExecutionSchema = z.object({
  queryKind: z.enum(["literal", "regex"]),
  candidateDocCount: z.number().int().nonnegative(),
  scannedDocCount: z.number().int().nonnegative(),
  matchCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  elapsedMs: z.number().int().nonnegative(),
  matches: z.array(searchMatchSchema),
  plannerMode: plannerModeSchema.optional(),
  extractableAnchors: z.array(z.string()).optional(),
  coveringGramCount: z.number().int().nonnegative().optional(),
  fallbackReason: z.string().optional(),
  plan: queryPlanSchema.optional(),
});

export const indexEnsureResponseSchema = z.object({
  workspaceId: z.string(),
  sourceMode: sourceModeSchema,
  sourceRevision: z.string(),
  baseIndexId: z.string(),
  overlayRevision: z.string(),
  trackedFileCount: z.number().int().nonnegative(),
  overlayFileCount: z.number().int().nonnegative(),
  storageDir: z.string(),
  gitignorePath: z.string().nullable(),
  gitignoreEntry: z.string().nullable(),
  gitignoreUpdated: z.boolean(),
  elapsedMs: z.number().int().nonnegative(),
});

export const indexStatusResponseSchema = z.object({
  ready: z.boolean(),
  workspaceId: z.string(),
  sourceMode: sourceModeSchema.optional(),
  sourceRevision: z.string().optional(),
  stalePaths: z.array(z.string()),
  fileCount: z.number().int().nonnegative(),
  overlayFileCount: z.number().int().nonnegative(),
  byteSize: z.number().int().nonnegative(),
  storageDir: z.string(),
});

export const indexClearResponseSchema = z.object({
  clearedScope: z.enum(["overlay", "all"]),
  removedPaths: z.array(z.string()),
  storageDir: z.string(),
  elapsedMs: z.number().int().nonnegative(),
});

export const inspectTermSchema = z.object({
  term: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  weight: z.number().optional(),
  nextMask: z.string().optional(),
  locMask: z.string().optional(),
});

export const inspectTermsResultSchema = z.object({
  mode: inspectModeSchema,
  termCount: z.number().int().nonnegative(),
  terms: z.array(inspectTermSchema),
  notes: z.array(z.string()),
});

export const suggestedLiteralArgsSchema = z.object({
  needle: z.string(),
  pathGlobs: z.array(z.string()).optional(),
  caseSensitive: z.boolean().optional(),
});

export const suggestedRegexArgsSchema = z.object({
  pattern: z.string(),
  flags: z.string().optional(),
  pathGlobs: z.array(z.string()).optional(),
});

export const suggestedExplainArgsSchema = z.object({
  pattern: z.string(),
  flags: z.string().optional(),
});

export const searchPlanResponseSchema = z.object({
  mustEnsureIndex: z.boolean(),
  recommendedFirstTool: searchWorkflowToolSchema,
  recommendedSequence: z.array(searchWorkflowToolSchema),
  suggestedLiteralArgs: suggestedLiteralArgsSchema.optional(),
  suggestedRegexArgs: suggestedRegexArgsSchema.optional(),
  suggestedExplainArgs: suggestedExplainArgsSchema.optional(),
  reasoning: z.array(z.string()),
  fallbackPlan: z.array(z.string()),
});
