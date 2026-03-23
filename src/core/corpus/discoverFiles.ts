import { readGitBaseCorpus, readGitWorkingTreeCorpus, detectGitContext } from "./gitMode.js";
import { readSnapshotCorpus } from "./snapshotMode.js";
import { CorpusFile, CorpusSelectionOptions, SourceMode } from "../shared/types.js";

export interface DiscoveredCorpus {
  sourceMode: SourceMode;
  sourceRevision: string;
  baseFiles: CorpusFile[];
  workingFiles: CorpusFile[];
}

/**
 * Discover the workspace corpus in either git-backed mode or plain snapshot mode.
 */
export async function discoverCorpus(
  options: CorpusSelectionOptions,
): Promise<DiscoveredCorpus> {
  const gitContext = await detectGitContext(options.workspaceRoot);
  if (gitContext) {
    const [baseFiles, workingFiles] = await Promise.all([
      readGitBaseCorpus(options, gitContext),
      readGitWorkingTreeCorpus(options),
    ]);

    return {
      sourceMode: "git",
      sourceRevision: `git:${gitContext.headSha}`,
      baseFiles,
      workingFiles,
    };
  }

  const files = await readSnapshotCorpus(options);
  const snapshotHashSource = files
    .map((file) => `${file.relativePath}:${file.contentHash}`)
    .join("\n");

  return {
    sourceMode: "snapshot",
    sourceRevision: `snapshot:${(await import("../shared/hashing.js")).hashContent(snapshotHashSource)}`,
    baseFiles: files,
    workingFiles: files,
  };
}
