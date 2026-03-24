import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod/v4";

export const INVESTIGATION_INTENT_OPTIONS = [
  "exact-string",
  "regex",
  "unknown",
] as const;

/**
 * Complete the workflow intent hint for prompt consumers.
 */
export function completeInvestigationIntent(
  value: string | undefined,
): (typeof INVESTIGATION_INTENT_OPTIONS)[number][] {
  return INVESTIGATION_INTENT_OPTIONS.filter((option) =>
    option.startsWith((value ?? "").toString()),
  );
}

/**
 * Build a workflow prompt that steers an agent through the MCP search tools in the right order.
 */
export function getInvestigateWithRevEngCursorRegexMcpPrompt(args: {
  objective: string;
  suspectedPattern?: string;
  pathHints?: string[];
  intent?: (typeof INVESTIGATION_INTENT_OPTIONS)[number];
}): GetPromptResult {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Investigate this objective with rev-eng-cursor-regex-mcp: ${args.objective}

Workflow:
1. Read rev-eng-cursor-regex-mcp://docs/decision-tree.
2. Call search.plan.
3. If search.plan says mustEnsureIndex is true, call index.ensure first.
4. Follow the recommendedSequence exactly.
5. Prefer search.literal for exact identifiers and fixed strings.
6. If query.explain reports weak anchors or full-scan fallback, narrow the pattern and add pathGlobs before retrying.

Initial suspected pattern: ${args.suspectedPattern ?? "none supplied"}`,
        },
      },
      {
        role: "user",
        content: {
          type: "text",
          text: `Intent hint: ${args.intent ?? "unknown"}

Path hints: ${args.pathHints?.join(", ") ?? "none supplied"}`,
        },
      },
    ],
  };
}

export const investigateWithRevEngCursorRegexMcpArgsSchema = {
  objective: z.string().describe("What the agent is trying to investigate."),
  suspectedPattern: z.string().optional().describe("Optional first-pass search pattern or identifier."),
  pathHints: z.array(z.string()).optional().describe("Optional folders or relative path globs that should narrow the search plan."),
  intent: completable(
    z.enum(INVESTIGATION_INTENT_OPTIONS).optional().describe("Optional intent hint for the search workflow."),
    (value) => completeInvestigationIntent(value?.toString()),
  ),
};
