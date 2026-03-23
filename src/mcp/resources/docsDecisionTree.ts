import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Return the canonical search decision tree used by host integrations and agent skills.
 */
export async function readDecisionTreeResource(uri: URL): Promise<ReadResourceResult> {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# rev-eng-cursor-regex-mcp Decision Tree

1. Call \`search.plan\` for exploratory or agent-driven search tasks.
2. If \`mustEnsureIndex\` is true, call \`index.ensure\` first.
3. If the target is an exact identifier, token, constant, env var, filename, or fixed string, use \`search.literal\`.
4. If the target is a regex or the pattern is uncertain, call \`query.explain\` before \`search.regex\`.
5. If \`plannerMode\` is \`full-scan-fallback\` or the plan reports weak anchors, narrow the pattern and add \`pathGlobs\` before retrying.
6. Use \`document.inspect_terms\` only to debug tokenization or sparse planning problems.
7. Use \`index.clear\` only to recover from stale or corrupt local index state.

Canonical rules:
- exact-string -> \`search.literal\`
- uncertain or broad regex -> \`query.explain\`, then \`search.regex\`
- broad fallback -> narrow the pattern and scope it with \`pathGlobs\`
- shell \`rg\` or \`grep\` is a fallback only after MCP search is insufficient or when the task is an exact known-path lookup`,
      },
    ],
  };
}
