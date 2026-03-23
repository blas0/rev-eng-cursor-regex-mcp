import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Return the agent workflow resource content.
 */
export async function readUsagePlaybookResource(uri: URL): Promise<ReadResourceResult> {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# rev-eng-cursor-regex-mcp Usage Playbook

1. Call \`index.ensure\` at the start of a session or after heavy edits.
2. Use \`search.literal\` for exact identifiers and fixed strings.
3. Use \`query.explain\` before broad regexes.
4. Use \`search.regex\` only when real regex syntax is required.
5. Use \`document.inspect_terms\` only to debug tokenization or query planning.
6. Use \`index.clear\` only to recover from stale or corrupt local state.`,
      },
    ],
  };
}
