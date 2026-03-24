import path from "node:path";
import { promises as fs } from "node:fs";
import { discoverCorpus } from "../corpus/discoverFiles.js";
import { buildBaseIndex, buildOverlayIndex } from "./builder.js";
import { ensureIndexRootIgnored } from "./gitignore.js";
import {
  clearIndexStorage,
  computeStoredByteSize,
  resolveCurrentArtifactPaths,
  writeBaseIndexArtifacts,
  writeOverlayArtifacts,
} from "./storage.js";
import { loadActiveIndexBundle } from "./loader.js";
import { mergeActiveDocs } from "./overlay.js";
import { readJsonFile, resolveToolOptions, writeCurrentPointer, writeJsonFile } from "../shared/paths.js";
import {
  CurrentIndexPointer,
  DocRecord,
  EnsureIndexOptions,
  IndexBuildResult,
  IndexManifest,
} from "../shared/types.js";
import { getWorkspaceStorageDir, getManifestPath } from "../shared/paths.js";
import { toSafeId } from "../shared/hashing.js";

function normalizeGlobs(globs: string[] | undefined): string[] {
  return globs && globs.length > 0 ? globs : ["**/*"];
}

function compareCurrentState(
  activeDocs: Map<string, { contentHash: string }>,
  workingFiles: Array<{ relativePath: string; contentHash: string }>,
): string[] {
  const stale = new Set<string>();
  const workingMap = new Map(
    workingFiles.map((file) => [file.relativePath, file.contentHash]),
  );

  for (const [relativePath, doc] of activeDocs.entries()) {
    const workingHash = workingMap.get(relativePath);
    if (!workingHash || workingHash !== doc.contentHash) {
      stale.add(relativePath);
    }
    workingMap.delete(relativePath);
  }

  for (const relativePath of workingMap.keys()) {
    stale.add(relativePath);
  }

  return [...stale].sort();
}

/**
 * Build or refresh the active index for a workspace.
 */
export async function ensureIndex(
  options: EnsureIndexOptions = {},
): Promise<IndexBuildResult> {
  const toolOptions = resolveToolOptions(options);
  const includeGlobs = normalizeGlobs(options.includeGlobs);
  const excludeGlobs = options.excludeGlobs ?? [];
  const refreshOverlay = options.refreshOverlay ?? true;
  const workspaceId = toSafeId("ws", toolOptions.workspaceRoot);
  const gitignoreBootstrap = await ensureIndexRootIgnored({
    workspaceRoot: toolOptions.workspaceRoot,
    indexDir: toolOptions.indexDir,
    bootstrapGitignore: options.bootstrapGitignore ?? true,
  });

  const corpus = await discoverCorpus({
    workspaceRoot: toolOptions.workspaceRoot,
    includeGlobs,
    excludeGlobs,
  });

  const storageDir = getWorkspaceStorageDir(toolOptions.indexDir, workspaceId);
  await fs.mkdir(storageDir, { recursive: true });

  const pointer = (await readJsonFile<CurrentIndexPointer>(
    path.join(storageDir, "current.json"),
  )) ?? null;

  let baseManifest: IndexManifest | null = null;
  let baseDocs: DocRecord[] = [];
  let baseIndexId = "";

  const expectedBase = await buildBaseIndex({
    workspaceRoot: toolOptions.workspaceRoot,
    workspaceId,
    sourceMode: corpus.sourceMode,
    sourceRevision: corpus.sourceRevision,
    includeGlobs,
    excludeGlobs,
    files: corpus.baseFiles,
  });
  baseIndexId = expectedBase.baseIndexId;

  if (
    !options.forceRebuild &&
    pointer?.baseIndexId === expectedBase.baseIndexId &&
    pointer.sourceRevision === corpus.sourceRevision
  ) {
    baseManifest = await readJsonFile<IndexManifest>(
      getManifestPath(toolOptions.indexDir, workspaceId, expectedBase.baseIndexId),
    );
    baseDocs =
      (await readJsonFile<typeof expectedBase.docs>(
        path.join(storageDir, expectedBase.baseIndexId, "docs.json"),
      )) ?? [];
  }

  if (!baseManifest || baseDocs.length === 0 || options.forceRebuild) {
    baseManifest = expectedBase.manifest;
    baseDocs = expectedBase.docs;
    await writeBaseIndexArtifacts({
      indexDir: toolOptions.indexDir,
      workspaceId,
      baseIndexId: expectedBase.baseIndexId,
      manifest: baseManifest,
      docs: baseDocs,
      lookup: expectedBase.lookup,
      postings: expectedBase.postings,
    });
  }

  let overlayFileCount = 0;
  let overlaySummary = baseManifest.overlay;
  if (refreshOverlay) {
    const overlayBuild = await buildOverlayIndex({
      sourceRevision: corpus.sourceRevision,
      baseDocs,
      workingFiles: corpus.workingFiles,
    });
    overlayFileCount = overlayBuild.docs.length;
    overlaySummary = overlayBuild.summary;
    baseManifest.overlay = overlaySummary;

    await Promise.all([
      writeOverlayArtifacts({
        indexDir: toolOptions.indexDir,
        workspaceId,
        baseIndexId,
        summary: overlayBuild.summary,
        docs: overlayBuild.docs,
        lookup: overlayBuild.lookup,
        postings: overlayBuild.postings,
      }),
      writeJsonFile(
        getManifestPath(toolOptions.indexDir, workspaceId, baseIndexId),
        baseManifest,
      ),
    ]);
  }

  await writeCurrentPointer(toolOptions.indexDir, workspaceId, {
    workspaceId,
    workspaceRoot: toolOptions.workspaceRoot,
    sourceMode: corpus.sourceMode,
    sourceRevision: corpus.sourceRevision,
    baseIndexId,
    includeGlobs,
    excludeGlobs,
    updatedAt: new Date().toISOString(),
  });

  baseManifest.byteSize = await computeStoredByteSize(
    resolveCurrentArtifactPaths(toolOptions.indexDir, workspaceId, baseIndexId),
  );
  await writeJsonFile(getManifestPath(toolOptions.indexDir, workspaceId, baseIndexId), baseManifest);

  return {
    manifest: baseManifest,
    workspaceRoot: toolOptions.workspaceRoot,
    workspaceId,
    storageDir,
    trackedFileCount: baseDocs.length,
    overlayFileCount,
    gitignorePath: gitignoreBootstrap.gitignorePath,
    gitignoreEntry: gitignoreBootstrap.gitignoreEntry,
    gitignoreUpdated: gitignoreBootstrap.gitignoreUpdated,
  };
}

/**
 * Describe the active index and report any working-tree files that make it stale.
 */
export async function getIndexStatus(options: {
  workspaceRoot?: string;
  indexDir?: string;
}): Promise<{
  ready: boolean;
  workspaceId: string;
  sourceMode?: string;
  sourceRevision?: string;
  stalePaths: string[];
  fileCount: number;
  overlayFileCount: number;
  byteSize: number;
  storageDir: string;
}> {
  const toolOptions = resolveToolOptions(options);
  const workspaceId = toSafeId("ws", toolOptions.workspaceRoot);
  const storageDir = getWorkspaceStorageDir(toolOptions.indexDir, workspaceId);
  const bundle = await loadActiveIndexBundle(toolOptions.indexDir, workspaceId);
  if (!bundle) {
    return {
      ready: false,
      workspaceId,
      stalePaths: [],
      fileCount: 0,
      overlayFileCount: 0,
      byteSize: 0,
      storageDir,
    };
  }

  const corpus = await discoverCorpus({
    workspaceRoot: toolOptions.workspaceRoot,
    includeGlobs: bundle.manifest.includeGlobs,
    excludeGlobs: bundle.manifest.excludeGlobs,
  });
  const activeDocs = mergeActiveDocs({
    baseDocs: bundle.docs,
    overlayDocs: bundle.overlayDocs,
    deletedPaths: bundle.deletedPaths,
  });

  return {
    ready: true,
    workspaceId,
    sourceMode: bundle.manifest.sourceMode,
    sourceRevision: bundle.manifest.sourceRevision,
    stalePaths: compareCurrentState(activeDocs, corpus.workingFiles),
    fileCount: bundle.docs.length,
    overlayFileCount: bundle.overlayDocs.length,
    byteSize: await computeStoredByteSize(
      resolveCurrentArtifactPaths(
        toolOptions.indexDir,
        workspaceId,
        bundle.manifest.baseIndexId,
      ),
    ),
    storageDir,
  };
}

/**
 * Delete the overlay or the entire cache for a workspace.
 */
export async function clearIndex(options: {
  workspaceRoot?: string;
  indexDir?: string;
  scope: "overlay" | "all";
}): Promise<{ removedPaths: string[]; storageDir: string }> {
  const toolOptions = resolveToolOptions(options);
  const workspaceId = toSafeId("ws", toolOptions.workspaceRoot);
  const storageDir = getWorkspaceStorageDir(toolOptions.indexDir, workspaceId);

  if (options.scope === "all") {
    await clearIndexStorage(storageDir);
    return {
      removedPaths: [storageDir],
      storageDir,
    };
  }

  const bundle = await loadActiveIndexBundle(toolOptions.indexDir, workspaceId);
  if (!bundle) {
    return {
      removedPaths: [],
      storageDir,
    };
  }

  const overlayDir = path.join(storageDir, bundle.manifest.baseIndexId, "overlay");
  await clearIndexStorage(overlayDir);
  const manifestPath = getManifestPath(
    toolOptions.indexDir,
    workspaceId,
    bundle.manifest.baseIndexId,
  );
  bundle.manifest.overlay = {
    revision: "overlay-empty",
    fileCount: 0,
    deletedPaths: [],
    changedPaths: [],
    builtAt: new Date().toISOString(),
    byteSize: 0,
  };
  await writeJsonFile(manifestPath, bundle.manifest);

  return {
    removedPaths: [overlayDir],
    storageDir,
  };
}
