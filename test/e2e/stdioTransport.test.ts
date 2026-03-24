import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createTempWorkspace } from "../helpers/tempWorkspace.js";

const require = createRequire(import.meta.url);
const tsxPackageJsonPath = require.resolve("tsx/package.json");
const tsxPath = path.join(path.dirname(tsxPackageJsonPath), "./dist/cli.mjs");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("stdio MCP transport", () => {
  it("lists tools, offers prompt completion, and performs workflow-planned search", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-stdio");
    await fs.writeFile(path.join(workspace, "sample.txt"), "HELLO_WORLD\n", "utf8");

    const client = new Client({
      name: "rev-eng-cursor-regex-mcp-test-client",
      version: "0.1.0",
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [tsxPath, path.join(repoRoot, "src/cli.ts"), "stdio"],
      cwd: repoRoot,
      env: {
        ...process.env,
        REV_ENG_CURSOR_REGEX_MCP_WORKSPACE_ROOT: workspace,
      } as Record<string, string>,
      stderr: "pipe",
    });

    await client.connect(transport);
    const toolList = await client.listTools();
    const promptCompletion = await client.complete({
      ref: {
        type: "ref/prompt",
        name: "investigate-with-rev-eng-cursor-regex-mcp",
      },
      argument: {
        name: "intent",
        value: "re",
      },
    });
    expect(toolList.tools.some((tool) => tool.name === "search.regex")).toBe(true);
    expect(toolList.tools.some((tool) => tool.name === "search.plan")).toBe(true);
    expect(
      toolList.tools.some(
        (tool) => tool.name === "search.plan" && tool.outputSchema !== undefined,
      ),
    ).toBe(true);
    expect(promptCompletion.completion.values).toContain("regex");

    const plan = await client.callTool({
      name: "search.plan",
      arguments: {
        workspaceRoot: workspace,
        objective: "Find `HELLO_WORLD`",
      },
    });
    expect(plan.structuredContent?.recommendedFirstTool).toBe("index.ensure");

    await client.callTool({
      name: "index.ensure",
      arguments: { workspaceRoot: workspace },
    });
    const search = await client.callTool({
      name: "search.literal",
      arguments: { workspaceRoot: workspace, needle: "HELLO_WORLD" },
    });

    expect(search.structuredContent).toBeTruthy();
    await client.close();
  });
});
