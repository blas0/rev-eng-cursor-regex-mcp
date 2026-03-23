import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Build a prompt that helps an agent rewrite a broad pattern into a sparse-index-friendly one.
 */
export function getRefineRegexPatternPrompt(args: {
  pattern: string;
  goal?: string;
}): GetPromptResult {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Rewrite this ECMAScript regex so it remains correct but yields stronger literal anchors for sparse n-gram planning.

Pattern: ${args.pattern}
Goal: ${args.goal ?? "Make the search narrower without changing intent."}

Prefer explicit literals, smaller alternations, and path scoping when possible.`,
        },
      },
    ],
  };
}
