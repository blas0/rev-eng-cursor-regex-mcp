import path from "node:path";
import { promises as fs } from "node:fs";
import {
  CurrentIndexPointer,
  ResolvedToolOptions,
  RuntimeConfig,
} from "./types.js";

/**
 * Resolve the runtime configuration from explicit overrides, environment variables, and defaults.
 */
export function resolveRuntimeConfig(
  overrides: Partial<RuntimeConfig> = {},
): RuntimeConfig {
  const workspaceRoot = path.resolve(
    overrides.workspaceRoot ??
      process.env.REV_ENG_CURSOR_REGEX_MCP_WORKSPACE_ROOT ??
      process.cwd(),
  );

  const indexDir = path.resolve(
    overrides.indexDir ??
      process.env.REV_ENG_CURSOR_REGEX_MCP_INDEX_DIR ??
      workspaceRoot,
  );

  const httpHost =
    overrides.httpHost ??
    process.env.REV_ENG_CURSOR_REGEX_MCP_HTTP_HOST ??
    "127.0.0.1";
  const httpPort = Number(
    overrides.httpPort ??
      process.env.REV_ENG_CURSOR_REGEX_MCP_HTTP_PORT ??
      3333,
  );

  return {
    workspaceRoot,
    indexDir,
    httpHost,
    httpPort,
  };
}

/**
 * Resolve the filesystem locations used by tool handlers.
 */
export function resolveToolOptions(input: {
  workspaceRoot?: string;
  indexDir?: string;
}): ResolvedToolOptions {
  const config = resolveRuntimeConfig(input);
  return {
    workspaceRoot: config.workspaceRoot,
    indexDir: config.indexDir,
  };
}

export function getIndexRoot(indexDir: string): string {
  return path.join(indexDir, ".rev-eng-cursor-regex-mcp");
}

export function getWorkspaceStorageDir(indexDir: string, workspaceId: string): string {
  return path.join(getIndexRoot(indexDir), "indexes", workspaceId);
}

export function getBaseIndexDir(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getWorkspaceStorageDir(indexDir, workspaceId), baseIndexId);
}

export function getCurrentPointerPath(indexDir: string, workspaceId: string): string {
  return path.join(getWorkspaceStorageDir(indexDir, workspaceId), "current.json");
}

export function getManifestPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getBaseIndexDir(indexDir, workspaceId, baseIndexId), "manifest.json");
}

export function getDocsPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getBaseIndexDir(indexDir, workspaceId, baseIndexId), "docs.json");
}

export function getLookupPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getBaseIndexDir(indexDir, workspaceId, baseIndexId), "lookup.bin");
}

export function getPostingsPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getBaseIndexDir(indexDir, workspaceId, baseIndexId), "postings.bin");
}

export function getOverlayDir(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getBaseIndexDir(indexDir, workspaceId, baseIndexId), "overlay");
}

export function getOverlayManifestPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getOverlayDir(indexDir, workspaceId, baseIndexId), "manifest.json");
}

export function getOverlayDocsPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getOverlayDir(indexDir, workspaceId, baseIndexId), "docs.json");
}

export function getOverlayLookupPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getOverlayDir(indexDir, workspaceId, baseIndexId), "lookup.bin");
}

export function getOverlayPostingsPath(
  indexDir: string,
  workspaceId: string,
  baseIndexId: string,
): string {
  return path.join(getOverlayDir(indexDir, workspaceId, baseIndexId), "postings.bin");
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const value = await fs.readFile(filePath, "utf8");
    return JSON.parse(value) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readCurrentPointer(
  indexDir: string,
  workspaceId: string,
): Promise<CurrentIndexPointer | null> {
  return readJsonFile<CurrentIndexPointer>(getCurrentPointerPath(indexDir, workspaceId));
}

export async function writeCurrentPointer(
  indexDir: string,
  workspaceId: string,
  value: CurrentIndexPointer,
): Promise<void> {
  await writeJsonFile(getCurrentPointerPath(indexDir, workspaceId), value);
}
