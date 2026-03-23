import path from "node:path";
import { promises as fs } from "node:fs";
import {
  getBaseIndexDir,
  getDocsPath,
  getLookupPath,
  getManifestPath,
  getOverlayDir,
  getOverlayDocsPath,
  getOverlayLookupPath,
  getOverlayManifestPath,
  getOverlayPostingsPath,
  getPostingsPath,
  ensureDir,
  writeJsonFile,
} from "../shared/paths.js";
import { DocRecord, IndexManifest, OverlaySummary } from "../shared/types.js";

/**
 * Persist a base index build to disk.
 */
export async function writeBaseIndexArtifacts(options: {
  indexDir: string;
  workspaceId: string;
  baseIndexId: string;
  manifest: IndexManifest;
  docs: DocRecord[];
  lookup: Buffer;
  postings: Buffer;
}): Promise<void> {
  const baseDir = getBaseIndexDir(options.indexDir, options.workspaceId, options.baseIndexId);
  await ensureDir(baseDir);
  await Promise.all([
    writeJsonFile(getManifestPath(options.indexDir, options.workspaceId, options.baseIndexId), options.manifest),
    writeJsonFile(getDocsPath(options.indexDir, options.workspaceId, options.baseIndexId), options.docs),
    fs.writeFile(getLookupPath(options.indexDir, options.workspaceId, options.baseIndexId), options.lookup),
    fs.writeFile(getPostingsPath(options.indexDir, options.workspaceId, options.baseIndexId), options.postings),
  ]);
}

/**
 * Persist the current overlay state beneath the active base index.
 */
export async function writeOverlayArtifacts(options: {
  indexDir: string;
  workspaceId: string;
  baseIndexId: string;
  summary: OverlaySummary;
  docs: DocRecord[];
  lookup: Buffer;
  postings: Buffer;
}): Promise<void> {
  const overlayDir = getOverlayDir(options.indexDir, options.workspaceId, options.baseIndexId);
  await ensureDir(overlayDir);
  await Promise.all([
    writeJsonFile(getOverlayManifestPath(options.indexDir, options.workspaceId, options.baseIndexId), options.summary),
    writeJsonFile(getOverlayDocsPath(options.indexDir, options.workspaceId, options.baseIndexId), options.docs),
    fs.writeFile(getOverlayLookupPath(options.indexDir, options.workspaceId, options.baseIndexId), options.lookup),
    fs.writeFile(getOverlayPostingsPath(options.indexDir, options.workspaceId, options.baseIndexId), options.postings),
  ]);
}

/**
 * Remove cached local index data.
 */
export async function clearIndexStorage(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

/**
 * Compute the combined byte size of the stored index files.
 */
export async function computeStoredByteSize(filePaths: string[]): Promise<number> {
  const stats = await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        return await fs.stat(filePath);
      } catch {
        return null;
      }
    }),
  );
  return stats.reduce((total, stat) => total + (stat?.size ?? 0), 0);
}

export function resolveCurrentArtifactPaths(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string[] {
  return [
    getManifestPath(indexDir, workspaceId, baseIndexId),
    getDocsPath(indexDir, workspaceId, baseIndexId),
    getLookupPath(indexDir, workspaceId, baseIndexId),
    getPostingsPath(indexDir, workspaceId, baseIndexId),
    getOverlayManifestPath(indexDir, workspaceId, baseIndexId),
    getOverlayDocsPath(indexDir, workspaceId, baseIndexId),
    getOverlayLookupPath(indexDir, workspaceId, baseIndexId),
    getOverlayPostingsPath(indexDir, workspaceId, baseIndexId),
  ].map((filePath) => path.resolve(filePath));
}
