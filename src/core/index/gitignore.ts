import path from "node:path";
import { promises as fs } from "node:fs";
import { ensureDir, getIndexRoot } from "../shared/paths.js";

export interface GitignoreBootstrapResult {
  gitignorePath: string | null;
  gitignoreEntry: string | null;
  gitignoreUpdated: boolean;
}

function normalizeGitignoreEntry(line: string): string | null {
  const trimmed = line.trim();
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("!")
  ) {
    return null;
  }

  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const relative = path.relative(workspaceRoot, targetPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Ensure the workspace `.gitignore` excludes the local cache directory when the cache lives inside the workspace.
 */
export async function ensureIndexRootIgnored(options: {
  workspaceRoot: string;
  indexDir: string;
  bootstrapGitignore: boolean;
}): Promise<GitignoreBootstrapResult> {
  if (!options.bootstrapGitignore) {
    return {
      gitignorePath: null,
      gitignoreEntry: null,
      gitignoreUpdated: false,
    };
  }

  const indexRoot = getIndexRoot(options.indexDir);
  if (!isInsideWorkspace(options.workspaceRoot, indexRoot)) {
    return {
      gitignorePath: null,
      gitignoreEntry: null,
      gitignoreUpdated: false,
    };
  }

  const relativeIndexRoot = path
    .relative(options.workspaceRoot, indexRoot)
    .split(path.sep)
    .join("/");
  const entry = `${relativeIndexRoot}/`;
  const gitignorePath = path.join(options.workspaceRoot, ".gitignore");

  let current = "";
  try {
    current = await fs.readFile(gitignorePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const normalizedEntry = normalizeGitignoreEntry(entry);
  const alreadyIgnored = current
    .split(/\r?\n/)
    .some((line) => normalizeGitignoreEntry(line) === normalizedEntry);
  if (alreadyIgnored) {
    return {
      gitignorePath,
      gitignoreEntry: entry,
      gitignoreUpdated: false,
    };
  }

  let next = current;
  if (next.length > 0 && !next.endsWith("\n")) {
    next += "\n";
  }
  if (next.length > 0) {
    next += "\n";
  }
  next += "# rev-eng-cursor-regex-mcp cache\n";
  next += `${entry}\n`;

  await ensureDir(path.dirname(gitignorePath));
  await fs.writeFile(gitignorePath, next, "utf8");

  return {
    gitignorePath,
    gitignoreEntry: entry,
    gitignoreUpdated: true,
  };
}
