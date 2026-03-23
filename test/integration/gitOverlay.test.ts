import path from "node:path";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTempWorkspace } from "../helpers/tempWorkspace.js";
import { ensureIndex } from "../../src/core/index/manager.js";
import { runLiteralSearch } from "../../src/core/query/searchEngine.js";

function git(cwd: string, args: string[]) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

describe("git overlay indexing", () => {
  it("indexes HEAD content in the base layer and working-tree edits in the overlay", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-git");
    git(workspace, ["init"]);
    git(workspace, ["config", "user.email", "test@example.com"]);
    git(workspace, ["config", "user.name", "Test User"]);

    await fs.mkdir(path.join(workspace, "src"), { recursive: true });
    const filePath = path.join(workspace, "src", "config.ts");
    await fs.writeFile(filePath, "export const MAX_FILE_SIZE = 1024;\n", "utf8");
    git(workspace, ["add", "."]);
    git(workspace, ["commit", "-m", "initial"]);

    await fs.writeFile(filePath, "export const MAX_UPLOAD_BYTES = 2048;\n", "utf8");

    const ensured = await ensureIndex({ workspaceRoot: workspace });
    expect(ensured.manifest.sourceMode).toBe("git");
    expect(ensured.overlayFileCount).toBe(2);
    expect(ensured.gitignoreEntry).toBe(".rev-eng-cursor-regex-mcp/");
    expect(ensured.gitignoreUpdated).toBe(true);

    const gitignore = await fs.readFile(path.join(workspace, ".gitignore"), "utf8");
    expect(gitignore).toContain(".rev-eng-cursor-regex-mcp/");

    const updated = await runLiteralSearch({
      workspaceRoot: workspace,
      needle: "MAX_UPLOAD_BYTES",
    });
    expect(updated.matchCount).toBe(1);

    const old = await runLiteralSearch({
      workspaceRoot: workspace,
      needle: "MAX_FILE_SIZE",
    });
    expect(old.matchCount).toBe(0);
  });
});
