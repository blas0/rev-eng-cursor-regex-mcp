import path from "node:path";
import { promises as fs } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { runHttpServer } from "../../src/entrypoints/http.js";
import { createTempWorkspace } from "../helpers/tempWorkspace.js";

describe("http MCP transport", () => {
  it("serves tools, resources, and prompts over /mcp", async () => {
    const workspace = await createTempWorkspace("rev-eng-cursor-regex-mcp-http");
    await fs.writeFile(path.join(workspace, "sample.txt"), "HTTP_SEARCH_TOKEN\n", "utf8");

    const port = 34561;
    const server = await runHttpServer({
      workspaceRoot: workspace,
      httpHost: "127.0.0.1",
      httpPort: port,
    });

    try {
      const client = new Client({
        name: "rev-eng-cursor-regex-mcp-http-client",
        version: "0.1.0",
      });
      const transport = new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${port}/mcp`),
      );
      await client.connect(transport);

      const tools = await client.listTools();
      const resources = await client.listResources();
      const prompt = await client.getPrompt({
        name: "investigate-with-rev-eng-cursor-regex-mcp",
        arguments: { objective: "Find HTTP_SEARCH_TOKEN" },
      });

      expect(tools.tools.some((tool) => tool.name === "index.ensure")).toBe(true);
      expect(
        resources.resources.some(
          (resource) =>
            resource.uri === "rev-eng-cursor-regex-mcp://docs/algorithms",
        ),
      ).toBe(true);
      expect(prompt.messages.length).toBeGreaterThan(0);

      await client.callTool({
        name: "index.ensure",
        arguments: { workspaceRoot: workspace },
      });
      const search = await client.callTool({
        name: "search.regex",
        arguments: { workspaceRoot: workspace, pattern: "HTTP_SEARCH_TOKEN" },
      });
      expect(search.structuredContent).toBeTruthy();
      await client.close();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
