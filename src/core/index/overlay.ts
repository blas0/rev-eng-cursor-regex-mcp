import { DocRecord } from "../shared/types.js";

/**
 * Return the active document view after overlay replacements and deletions are applied.
 */
export function mergeActiveDocs(options: {
  baseDocs: DocRecord[];
  overlayDocs: DocRecord[];
  deletedPaths: Set<string>;
}): Map<string, DocRecord> {
  const docs = new Map<string, DocRecord>();

  for (const doc of options.baseDocs) {
    if (options.deletedPaths.has(doc.relativePath)) {
      continue;
    }
    docs.set(doc.relativePath, doc);
  }

  for (const doc of options.overlayDocs) {
    docs.set(doc.relativePath, doc);
  }

  return docs;
}
