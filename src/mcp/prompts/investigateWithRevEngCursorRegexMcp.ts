import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Build a workflow prompt that steers an agent through the MCP search tools in the right order.
 */
export function getInvestigateWithRevEngCursorRegexMcpPrompt(args: {
  objective: string;
  suspectedPattern?: string;
}): GetPromptResult {
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Investigate this objective with rev-eng-cursor-regex-mcp: ${args.objective}

Workflow:
1. Call index.ensure.
2. If the search pattern is broad or uncertain, call query.explain first.
3. Prefer search.literal for exact identifiers.
4. Use search.regex only when regex syntax is necessary.
5. Narrow with pathGlobs before repeating a broad search.

Initial suspected pattern: ${args.suspectedPattern ?? "none supplied"}`,
        },
      },
    ],
  };
}
