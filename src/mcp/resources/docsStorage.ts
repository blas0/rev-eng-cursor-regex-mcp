import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Return the storage layout resource content.
 */
export async function readStorageResource(uri: URL): Promise<ReadResourceResult> {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# rev-eng-cursor-regex-mcp Storage Layout

- \`.rev-eng-cursor-regex-mcp/indexes/<workspaceId>/<baseIndexId>/manifest.json\` stores the active base manifest.
- \`lookup.bin\` stores fixed-width hash, offset, and length records for binary search.
- \`postings.bin\` stores delta-encoded document ids and positions.
- \`docs.json\` stores per-document metadata.
- \`overlay/\` stores the mutable working-tree layer and deleted-path tombstones.

The implementation is mmap-inspired rather than true mmap: the lookup file is loaded into memory, while postings are read by offset.`,
      },
    ],
  };
}
