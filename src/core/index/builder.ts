import { CorpusFile, DocRecord, EncodedPosting, IndexManifest, OverlaySummary } from "../shared/types.js";
import { buildAllSparseTerms } from "../query/sparseCovering.js";
import { hash64Hex, toSafeId } from "../shared/hashing.js";
import { encodePostings } from "./postings.js";
import { encodeLookup } from "./lookupTable.js";

interface SerializedIndex {
  docs: DocRecord[];
  lookup: Buffer;
  postings: Buffer;
}

async function buildSerializedIndex(
  files: CorpusFile[],
  source: "base" | "overlay",
): Promise<SerializedIndex> {
  const docs: DocRecord[] = files
    .slice()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    .map((file, docId) => ({
      docId,
      relativePath: file.relativePath,
      absolutePath: file.absolutePath,
      size: file.size,
      mtimeMs: file.mtimeMs,
      contentHash: file.contentHash,
      tracked: file.tracked,
      source,
    }));

  const docIdByPath = new Map(docs.map((doc) => [doc.relativePath, doc.docId]));
  const termMap = new Map<string, Map<number, number[]>>();

  for (const file of files) {
    const docId = docIdByPath.get(file.relativePath);
    if (docId === undefined) {
      continue;
    }

    for (const term of buildAllSparseTerms(file.content)) {
      const postings = termMap.get(term.term) ?? new Map<number, number[]>();
      const positions = postings.get(docId) ?? [];
      positions.push(term.start);
      postings.set(docId, positions);
      termMap.set(term.term, postings);
    }
  }

  const lookupRecords: Array<{ hashHex: string; offset: number; length: number }> = [];
  const postingBuffers: Buffer[] = [];
  let offset = 0;
  for (const term of [...termMap.keys()].sort()) {
    const postingsByDoc = termMap.get(term)!;
    const encoded = encodePostings(
      [...postingsByDoc.entries()].map(([docId, positions]): EncodedPosting => ({
        docId,
        positions,
      })),
    );
    postingBuffers.push(encoded);
    lookupRecords.push({
      hashHex: await hash64Hex(term),
      offset,
      length: encoded.length,
    });
    offset += encoded.length;
  }

  return {
    docs,
    lookup: encodeLookup(lookupRecords),
    postings: Buffer.concat(postingBuffers),
  };
}

/**
 * Build the immutable base index keyed by the active source revision.
 */
export async function buildBaseIndex(options: {
  workspaceRoot: string;
  workspaceId: string;
  sourceMode: "git" | "snapshot";
  sourceRevision: string;
  includeGlobs: string[];
  excludeGlobs: string[];
  files: CorpusFile[];
}): Promise<{
  baseIndexId: string;
  manifest: IndexManifest;
  docs: DocRecord[];
  lookup: Buffer;
  postings: Buffer;
}> {
  const baseIndexId = toSafeId(
    "ix",
    JSON.stringify({
      workspaceRoot: options.workspaceRoot,
      sourceRevision: options.sourceRevision,
      includeGlobs: options.includeGlobs,
      excludeGlobs: options.excludeGlobs,
    }),
  );

  const serialized = await buildSerializedIndex(options.files, "base");
  const manifest: IndexManifest = {
    version: 1,
    workspaceRoot: options.workspaceRoot,
    workspaceId: options.workspaceId,
    sourceMode: options.sourceMode,
    sourceRevision: options.sourceRevision,
    baseIndexId,
    createdAt: new Date().toISOString(),
    includeGlobs: options.includeGlobs,
    excludeGlobs: options.excludeGlobs,
    fileCount: serialized.docs.length,
    byteSize: serialized.lookup.length + serialized.postings.length,
    overlay: {
      revision: "overlay-empty",
      fileCount: 0,
      deletedPaths: [],
      changedPaths: [],
      builtAt: new Date().toISOString(),
      byteSize: 0,
    },
  };

  return {
    baseIndexId,
    manifest,
    docs: serialized.docs,
    lookup: serialized.lookup,
    postings: serialized.postings,
  };
}

/**
 * Build the mutable overlay that shadows local working-tree changes.
 */
export async function buildOverlayIndex(options: {
  sourceRevision: string;
  baseDocs: DocRecord[];
  workingFiles: CorpusFile[];
}): Promise<{
  summary: OverlaySummary;
  docs: DocRecord[];
  lookup: Buffer;
  postings: Buffer;
}> {
  const workingByPath = new Map(options.workingFiles.map((file) => [file.relativePath, file]));
  const changedFiles: CorpusFile[] = [];
  const changedPaths: string[] = [];
  const deletedPaths: string[] = [];

  for (const doc of options.baseDocs) {
    const working = workingByPath.get(doc.relativePath);
    if (!working) {
      deletedPaths.push(doc.relativePath);
      continue;
    }

    if (working.contentHash !== doc.contentHash) {
      changedFiles.push(working);
      changedPaths.push(doc.relativePath);
    }
    workingByPath.delete(doc.relativePath);
  }

  for (const file of workingByPath.values()) {
    changedFiles.push(file);
    changedPaths.push(file.relativePath);
  }

  const serialized = await buildSerializedIndex(changedFiles, "overlay");
  const revisionSource = JSON.stringify({
    sourceRevision: options.sourceRevision,
    changedPaths: changedFiles.map((file) => `${file.relativePath}:${file.contentHash}`),
    deletedPaths,
  });

  const summary: OverlaySummary = {
    revision: toSafeId("overlay", revisionSource),
    fileCount: serialized.docs.length,
    deletedPaths: deletedPaths.sort(),
    changedPaths: changedPaths.sort(),
    builtAt: new Date().toISOString(),
    byteSize: serialized.lookup.length + serialized.postings.length,
  };

  return {
    summary,
    docs: serialized.docs,
    lookup: serialized.lookup,
    postings: serialized.postings,
  };
}
