import { promises as fs } from "node:fs";
import {
  getDocsPath,
  getLookupPath,
  getOverlayDocsPath,
  getOverlayLookupPath,
  getOverlayPostingsPath,
  getPostingsPath,
  readCurrentPointer,
  readJsonFile,
} from "../shared/paths.js";
import { LoadedIndexBundle, DocRecord } from "../shared/types.js";
import { readIndexManifest, readOverlaySummary } from "./manifest.js";

async function readBufferOrEmpty(filePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Buffer.alloc(0);
    }
    throw error;
  }
}

/**
 * Load the currently active base index and overlay into memory.
 */
export async function loadActiveIndexBundle(
  indexDir: string,
  workspaceId: string,
): Promise<LoadedIndexBundle | null> {
  const pointer = await readCurrentPointer(indexDir, workspaceId);
  if (!pointer) {
    return null;
  }

  const manifest = await readIndexManifest(indexDir, workspaceId, pointer.baseIndexId);
  if (!manifest) {
    return null;
  }

  const overlay = await readOverlaySummary(indexDir, workspaceId, pointer.baseIndexId);
  const docs =
    (await readJsonFile<DocRecord[]>(
      getDocsPath(indexDir, workspaceId, pointer.baseIndexId),
    )) ?? [];
  const overlayDocs =
    (await readJsonFile<DocRecord[]>(
      getOverlayDocsPath(indexDir, workspaceId, pointer.baseIndexId),
    )) ?? [];

  return {
    manifest: {
      ...manifest,
      overlay: overlay ?? manifest.overlay,
    },
    docs,
    overlayDocs,
    deletedPaths: new Set(overlay?.deletedPaths ?? []),
    replacedPaths: new Set(overlayDocs.map((doc) => doc.relativePath)),
    lookup: await readBufferOrEmpty(getLookupPath(indexDir, workspaceId, pointer.baseIndexId)),
    postings: await readBufferOrEmpty(getPostingsPath(indexDir, workspaceId, pointer.baseIndexId)),
    overlayLookup: await readBufferOrEmpty(
      getOverlayLookupPath(indexDir, workspaceId, pointer.baseIndexId),
    ),
    overlayPostings: await readBufferOrEmpty(
      getOverlayPostingsPath(indexDir, workspaceId, pointer.baseIndexId),
    ),
  };
}
