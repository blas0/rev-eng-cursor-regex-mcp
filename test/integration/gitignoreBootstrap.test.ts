import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTempWorkspace } from "../helpers/tempWorkspace.js";
import { ensureIndex } from "../../src/core/index/manager.js";

describe("gitignore bootstrap", () => {
  it("does not touch the workspace gitignore when the cache root is outside the workspace", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-external-workspace");
    const externalIndexDir = await createTempWorkspace("rev-eng-cursor-regex-mcp-external-index");
    await fs.mkdir(path.join(workspace, "src"), { recursive: true });
    await fs.writeFile(
      path.join(workspace, "src", "token.ts"),
      "export const SEARCH_TOKEN = 'abc';\n",
      "utf8",
    );

    const ensured = await ensureIndex({
      workspaceRoot: workspace,
      indexDir: externalIndexDir,
    });

    expect(ensured.gitignorePath).toBeNull();
    expect(ensured.gitignoreEntry).toBeNull();
    expect(ensured.gitignoreUpdated).toBe(false);
    await expect(fs.stat(path.join(workspace, ".gitignore"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("skips gitignore bootstrapping when explicitly disabled", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-optout");
    await fs.mkdir(path.join(workspace, "src"), { recursive: true });
    await fs.writeFile(
      path.join(workspace, "src", "token.ts"),
      "export const SEARCH_TOKEN = 'abc';\n",
      "utf8",
    );

    const ensured = await ensureIndex({
      workspaceRoot: workspace,
      bootstrapGitignore: false,
    });

    expect(ensured.gitignorePath).toBeNull();
    expect(ensured.gitignoreEntry).toBeNull();
    expect(ensured.gitignoreUpdated).toBe(false);
    await expect(fs.stat(path.join(workspace, ".gitignore"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
