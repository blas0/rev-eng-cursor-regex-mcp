import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * Create an isolated temporary workspace for integration and e2e tests.
 */
export async function createTempWorkspace(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}
