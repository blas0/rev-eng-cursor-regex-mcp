import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { createTempWorkspace } from "../helpers/tempWorkspace.js";
import { ensureIndex } from "../../src/core/index/manager.js";
import { buildSearchPlan } from "../../src/core/query/searchPlan.js";

describe("search plan", () => {
  it("prefers literal search and ensures the index when an exact string is known", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-plan-literal");
    await fs.mkdir(path.join(workspace, "src"), { recursive: true });
    await fs.writeFile(
      path.join(workspace, "src", "token.ts"),
      "export const SEARCH_TOKEN = 'SEARCH_TOKEN';\n",
      "utf8",
    );

    const plan = await buildSearchPlan({
      workspaceRoot: workspace,
      objective: "Find `SEARCH_TOKEN` in src",
      pathHints: ["src/**"],
    });

    expect(plan.mustEnsureIndex).toBe(true);
    expect(plan.recommendedFirstTool).toBe("index.ensure");
    expect(plan.recommendedSequence).toEqual(["index.ensure", "search.literal"]);
    expect(plan.suggestedLiteralArgs?.needle).toBe("SEARCH_TOKEN");
    expect(plan.suggestedLiteralArgs?.pathGlobs).toEqual(["src/**"]);
  });

  it("routes weak regex patterns through query explanation before regex search", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-plan-regex");
    await fs.writeFile(path.join(workspace, "sample.txt"), "alpha beta gamma\n", "utf8");
    await ensureIndex({ workspaceRoot: workspace });

    const plan = await buildSearchPlan({
      workspaceRoot: workspace,
      objective: "Find regex matches for a broad phrase pattern",
      suspectedPattern: "(?:\\w+\\s+){2,}\\w+",
      pathHints: ["sample.txt"],
    });

    expect(plan.mustEnsureIndex).toBe(false);
    expect(plan.recommendedFirstTool).toBe("query.explain");
    expect(plan.recommendedSequence).toEqual(["query.explain", "search.regex"]);
    expect(plan.suggestedExplainArgs?.pattern).toBe("(?:\\w+\\s+){2,}\\w+");
    expect(plan.suggestedRegexArgs?.pathGlobs).toEqual(["sample.txt"]);
  });
});
