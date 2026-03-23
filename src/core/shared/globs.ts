import path from "node:path";

/**
 * Match a relative workspace path against a list of glob patterns.
 */
export function matchesAnyGlob(relativePath: string, globs: string[]): boolean {
  return globs.some((pattern) => path.matchesGlob(relativePath, pattern));
}
