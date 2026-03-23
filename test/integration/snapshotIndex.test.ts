import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTempWorkspace } from "../helpers/tempWorkspace.js";
import { ensureIndex, getIndexStatus } from "../../src/core/index/manager.js";
import { runLiteralSearch, runRegexSearch } from "../../src/core/query/searchEngine.js";
import { inspectTerms } from "../../src/core/query/termInspection.js";

describe("snapshot indexing", () => {
  it("builds and searches a non-git workspace", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-snapshot");
    await fs.writeFile(path.join(workspace, ".gitignore"), "ignored.txt\n", "utf8");
    await fs.mkdir(path.join(workspace, "src"), { recursive: true });
    await fs.writeFile(
      path.join(workspace, "src", "constants.ts"),
      "export const MAX_FILE_SIZE = 1024;\n",
      "utf8",
    );
    await fs.writeFile(path.join(workspace, "ignored.txt"), "MAX_FILE_SIZE\n", "utf8");

    const ensured = await ensureIndex({ workspaceRoot: workspace });
    expect(ensured.manifest.sourceMode).toBe("snapshot");
    expect(ensured.trackedFileCount).toBe(2);

    const status = await getIndexStatus({ workspaceRoot: workspace });
    expect(status.ready).toBe(true);
    expect(status.stalePaths).toEqual([]);

    const literal = await runLiteralSearch({
      workspaceRoot: workspace,
      needle: "MAX_FILE_SIZE",
    });
    expect(literal.matchCount).toBe(1);
    expect(literal.matches[0]?.path).toBe("src/constants.ts");

    const regex = await runRegexSearch({
      workspaceRoot: workspace,
      pattern: "MAX_.*SIZE",
      includePlan: true,
    });
    expect(regex.matchCount).toBe(1);
    expect(regex.plannerMode).toBe("literal-covering");
    expect(regex.plan?.extractableAnchors).toContain("MAX_");

    const inspected = await inspectTerms({
      path: path.join(workspace, "src", "constants.ts"),
      mode: "masked-trigram",
    });
    expect(inspected.mode).toBe("masked-trigram");
    expect(inspected.termCount).toBeGreaterThan(0);
  });
});
