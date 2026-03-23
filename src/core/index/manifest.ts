import { readJsonFile } from "../shared/paths.js";
import { CurrentIndexPointer, IndexManifest, OverlaySummary } from "../shared/types.js";
import {
  getManifestPath,
  getOverlayManifestPath,
} from "../shared/paths.js";

/**
 * Read a persisted base manifest.
 */
export async function readIndexManifest(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): Promise<IndexManifest | null> {
  return readJsonFile<IndexManifest>(getManifestPath(indexDir, workspaceId, baseIndexId));
}

/**
 * Read the current overlay summary for the active base index.
 */
export async function readOverlaySummary(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): Promise<OverlaySummary | null> {
  return readJsonFile<OverlaySummary>(
    getOverlayManifestPath(indexDir, workspaceId, baseIndexId),
  );
}

export type { CurrentIndexPointer };
