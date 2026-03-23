import path from "node:path";
import fg from "fast-glob";
import { createIgnoreMatcher } from "./ignoreRules.js";
import { readTextFileIfLikelyText } from "./textDetection.js";
import { CorpusFile, CorpusSelectionOptions } from "../shared/types.js";
import { hashContent } from "../shared/hashing.js";

/**
 * Discover text files from a non-git workspace snapshot using root ignore rules and optional globs.
 */
export async function readSnapshotCorpus(
  options: CorpusSelectionOptions,
): Promise<CorpusFile[]> {
  const matcher = await createIgnoreMatcher(
    options.workspaceRoot,
    options.excludeGlobs,
  );

  const candidates = await fg(options.includeGlobs, {
    cwd: options.workspaceRoot,
    onlyFiles: true,
    dot: true,
    unique: true,
    followSymbolicLinks: false,
    ignore: options.excludeGlobs,
  });

  const files: CorpusFile[] = [];
  for (const relativePath of candidates.sort()) {
    if (matcher.ignores(relativePath)) {
      continue;
    }

    const absolutePath = path.join(options.workspaceRoot, relativePath);
    const content = await readTextFileIfLikelyText(absolutePath);
    if (content === null) {
      continue;
    }

    const stat = await import("node:fs/promises").then((fs) => fs.stat(absolutePath));
    files.push({
      relativePath,
      absolutePath,
      content,
      contentHash: hashContent(content),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      tracked: false,
    });
  }

  return files;
}
