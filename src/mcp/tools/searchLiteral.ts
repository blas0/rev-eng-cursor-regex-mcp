import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runLiteralSearch } from "../../core/query/searchEngine.js";
import { RuntimeConfig } from "../../core/shared/types.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the indexed literal search tool.
 */
export function registerSearchLiteralTool(
  server: McpServer,
  defaults: Partial<RuntimeConfig>,
): void {
  server.registerTool(
    "search.literal",
    {
      title: "Search Literal",
      description:
        "Find exact text in indexed workspace files. Prefer this over regex when you already know the exact string.",
      inputSchema: {
        workspaceRoot: z.string().optional().describe("Absolute workspace root to search. Defaults to the server workspace."),
        needle: z.string().describe("Exact text to search for without any regex syntax."),
        caseSensitive: z.boolean().optional().describe("Set to false to perform a case-insensitive full-text match."),
        pathGlobs: z.array(z.string()).optional().describe("Optional relative glob patterns that narrow the search to specific folders or files."),
        maxResults: z.number().int().positive().optional().describe("Maximum number of matches to return. Defaults to 100."),
        beforeLines: z.number().int().nonnegative().optional().describe("Number of context lines to include before each match. Defaults to 1."),
        afterLines: z.number().int().nonnegative().optional().describe("Number of context lines to include after each match. Defaults to 1."),
        autoEnsureIndex: z.boolean().optional().describe("Refresh the local index automatically before searching. Defaults to true.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      const output = await runLiteralSearch({
        workspaceRoot: args.workspaceRoot ?? defaults.workspaceRoot,
        indexDir: defaults.indexDir,
        needle: args.needle,
        caseSensitive: args.caseSensitive,
        pathGlobs: args.pathGlobs,
        maxResults: args.maxResults,
        beforeLines: args.beforeLines,
        afterLines: args.afterLines,
        autoEnsureIndex: args.autoEnsureIndex,
      });
      return result(output);
    },
  );
}
