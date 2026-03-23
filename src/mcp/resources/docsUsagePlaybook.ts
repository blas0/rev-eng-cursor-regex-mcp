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

1. Read \`rev-eng-cursor-regex-mcp://docs/decision-tree\` for the canonical workflow policy.
2. Call \`search.plan\` for exploratory search objectives.
3. Follow the recommended sequence from \`search.plan\`, starting with \`index.ensure\` when required.
4. Use \`/rev-search\` in Claude Code or the Codex skill to enter the MCP-first workflow quickly.`,
      },
    ],
  };
}
