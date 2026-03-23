import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { getIndexRoot, readCurrentPointer, readJsonFile } from "../../core/shared/paths.js";
import { IndexManifest } from "../../core/shared/types.js";

async function listWorkspaceStatResources(indexDir: string) {
  const indexesDir = path.join(getIndexRoot(indexDir), "indexes");
  try {
    const entries = await fs.readdir(indexesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        uri: `rev-eng-cursor-regex-mcp://workspace/${entry.name}/stats`,
        name: entry.name,
      }));
  } catch {
    return [];
  }
}

/**
 * List known workspace stats resources.
 */
export async function listWorkspaceStatsResources(indexDir: string) {
  return {
    resources: await listWorkspaceStatResources(indexDir),
  };
}

/**
 * Read the summarized stats for a known workspace id.
 */
export async function readWorkspaceStatsResource(
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

  const baseDir = path.join(
    getIndexRoot(indexDir),
    "indexes",
    params.workspaceId,
    pointer.baseIndexId,
  );
  const manifest = await readJsonFile<IndexManifest>(path.join(baseDir, "manifest.json"));
  const overlay = await readJsonFile(path.join(baseDir, "overlay", "manifest.json"));
  const stats = {
    workspaceId: params.workspaceId,
    baseIndexId: pointer.baseIndexId,
    sourceRevision: manifest?.sourceRevision,
    fileCount: manifest?.fileCount ?? 0,
    overlayFileCount: manifest?.overlay.fileCount ?? 0,
    deletedPaths: manifest?.overlay.deletedPaths ?? [],
    changedPaths: manifest?.overlay.changedPaths ?? [],
    overlay,
  };
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(stats, null, 2),
      },
    ],
  };
}
