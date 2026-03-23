import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { getIndexRoot, readCurrentPointer, readJsonFile } from "../../core/shared/paths.js";
import { IndexManifest } from "../../core/shared/types.js";

async function listWorkspaceResources(indexDir: string) {
  const indexesDir = path.join(getIndexRoot(indexDir), "indexes");
  try {
    const entries = await fs.readdir(indexesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        uri: `rev-eng-cursor-regex-mcp://workspace/${entry.name}/manifest`,
        name: entry.name,
      }));
  } catch {
    return [];
  }
}

/**
 * List known workspace manifest resources.
 */
export async function listWorkspaceManifestResources(indexDir: string) {
  return {
    resources: await listWorkspaceResources(indexDir),
  };
}

/**
 * Read the active manifest for a known workspace id.
 */
export async function readWorkspaceManifestResource(
  indexDir: string,
  uri: URL,
  params: { workspaceId: string },
): Promise<ReadResourceResult> {
  const pointer = await readCurrentPointer(indexDir, params.workspaceId);
  if (!pointer) {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "No active index for workspace." }, null, 2),
        },
      ],
    };
  }

  const manifestPath = path.join(
    getIndexRoot(indexDir),
    "indexes",
    params.workspaceId,
    pointer.baseIndexId,
    "manifest.json",
  );
  const manifest = await readJsonFile<IndexManifest>(manifestPath);
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(manifest, null, 2),
      },
    ],
  };
}
