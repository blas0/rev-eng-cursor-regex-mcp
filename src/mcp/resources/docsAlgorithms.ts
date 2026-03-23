import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Return the algorithm overview resource content.
 */
export async function readAlgorithmsResource(uri: URL): Promise<ReadResourceResult> {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# rev-eng-cursor-regex-mcp Algorithms

rev-eng-cursor-regex-mcp exposes one production backend and several explanatory views.

- Classic trigram indexing is exposed for explanation and inspection only.
- Suffix arrays are documented as a historical detour and are not implemented as a runtime backend.
- Masked trigrams are exposed through \`document.inspect_terms\` for diagnostics only.
- Sparse n-grams are the production candidate-pruning backend used by \`search.regex\` and \`search.literal\`.

The server always performs deterministic verification against the actual file contents after candidate pruning.`,
      },
    ],
  };
}
