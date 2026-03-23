import path from "node:path";
import { promises as fs } from "node:fs";
import ignore, { Ignore } from "ignore";

const DEFAULT_IGNORES = [
  ".git",
  ".rev-eng-cursor-regex-mcp",
  "node_modules",
  "dist",
];

/**
 * Build an ignore matcher from the workspace root and caller-provided glob exclusions.
 */
export async function createIgnoreMatcher(
  workspaceRoot: string,
  excludeGlobs: string[],
): Promise<Ignore> {
  const matcher = ignore().add(DEFAULT_IGNORES).add(excludeGlobs);
  const gitignorePath = path.join(workspaceRoot, ".gitignore");

  try {
    const gitignore = await fs.readFile(gitignorePath, "utf8");
    matcher.add(gitignore);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return matcher;
}
