import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import fg from "fast-glob";
import { CorpusFile, CorpusSelectionOptions } from "../shared/types.js";
import { hashContent } from "../shared/hashing.js";
import { createIgnoreMatcher } from "./ignoreRules.js";
import { readTextFileIfLikelyText } from "./textDetection.js";
import { matchesAnyGlob } from "../shared/globs.js";

const execFileAsync = promisify(execFile);

export interface GitContext {
  repoRoot: string;
  workspacePrefix: string;
  headSha: string;
}

async function git(
  cwd: string,
  args: string[],
  options: { trim?: boolean } = {},
): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, maxBuffer: 20 * 1024 * 1024 });
  return options.trim === false ? result.stdout : result.stdout.trim();
}

/**
 * Detect git metadata for a workspace. Returns null when the directory is not inside a git repository.
 */
export async function detectGitContext(
  workspaceRoot: string,
): Promise<GitContext | null> {
  try {
    const repoRoot = await git(workspaceRoot, ["rev-parse", "--show-toplevel"]);
    const headSha = await git(workspaceRoot, ["rev-parse", "HEAD"]);
    const workspacePrefix = path
      .relative(repoRoot, workspaceRoot)
      .split(path.sep)
      .filter(Boolean)
      .join("/");

    return {
      repoRoot,
      workspacePrefix,
      headSha,
    };
  } catch {
    return null;
  }
}

function normalizeGitPath(value: string): string {
  return value.split(path.sep).join("/");
}

function matchesWorkspacePrefix(relativeToRepo: string, workspacePrefix: string): boolean {
  return workspacePrefix === ""
    ? true
    : relativeToRepo === workspacePrefix || relativeToRepo.startsWith(`${workspacePrefix}/`);
}

/**
 * Read the tracked files from HEAD so the base index is commit-keyed rather than working-tree keyed.
 */
export async function readGitBaseCorpus(
  options: CorpusSelectionOptions,
  gitContext: GitContext,
): Promise<CorpusFile[]> {
  const matcher = await createIgnoreMatcher(
    options.workspaceRoot,
    options.excludeGlobs,
  );

  const output = await git(gitContext.repoRoot, ["ls-tree", "-r", "--name-only", "HEAD"]);
  const files: CorpusFile[] = [];
  for (const relativeToRepo of output.split("\n").filter(Boolean)) {
    if (!matchesWorkspacePrefix(relativeToRepo, gitContext.workspacePrefix)) {
      continue;
    }

    const relativePath = normalizeGitPath(
      path.relative(gitContext.workspacePrefix || ".", relativeToRepo),
    );

    if (relativePath.startsWith("..") || matcher.ignores(relativePath)) {
      continue;
    }

    if (!fg.isDynamicPattern(options.includeGlobs.join(","))) {
      // no-op: this keeps fast-glob imported consistently across corpus modes
    }

    const included = matchesAnyGlob(relativePath, options.includeGlobs);
    if (!included) {
      continue;
    }

    const gitObjectPath = `${gitContext.headSha}:${relativeToRepo}`;
    const content = await git(gitContext.repoRoot, ["show", gitObjectPath], {
      trim: false,
    });
    if (content.includes("\u0000")) {
      continue;
    }

    const absolutePath = path.join(options.workspaceRoot, relativePath);
    files.push({
      relativePath,
      absolutePath,
      content,
      contentHash: hashContent(content),
      size: Buffer.byteLength(content),
      mtimeMs: 0,
      tracked: true,
    });
  }

  return files;
}

/**
 * Read current working-tree text files so overlay changes stay fresh without rebuilding the base index.
 */
export async function readGitWorkingTreeCorpus(
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

    const stat = await fs.stat(absolutePath);
    files.push({
      relativePath,
      absolutePath,
      content,
      contentHash: hashContent(content),
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      tracked: true,
    });
  }

  return files;
}
