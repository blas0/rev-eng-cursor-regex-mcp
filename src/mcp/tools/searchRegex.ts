import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { runRegexSearch } from "../../core/query/searchEngine.js";
import { RuntimeConfig } from "../../core/shared/types.js";
import { searchExecutionSchema } from "../schemas.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the indexed regex search tool.
 */
export function registerSearchRegexTool(
  server: McpServer,
  defaults: Partial<RuntimeConfig>,
): void {
  server.registerTool(
    "search.regex",
    {
      title: "Search Regex",
      description:
        "Find ECMAScript regular-expression matches in indexed workspace files using sparse n-gram pruning before deterministic verification.",
      inputSchema: {
        workspaceRoot: z.string().optional().describe("Absolute workspace root to search. Defaults to the server workspace."),
        pattern: z.string().describe("ECMAScript regular expression source without surrounding slashes."),
        flags: z.string().optional().describe("ECMAScript regex flags such as `gm` or `u`. Ignore-case searches fall back to a full scan."),
        pathGlobs: z.array(z.string()).optional().describe("Optional relative glob patterns that narrow the search to specific folders or files."),
        maxResults: z.number().int().positive().optional().describe("Maximum number of matches to return. Defaults to 100."),
        beforeLines: z.number().int().nonnegative().optional().describe("Number of context lines to include before each match. Defaults to 1."),
        afterLines: z.number().int().nonnegative().optional().describe("Number of context lines to include after each match. Defaults to 1."),
        autoEnsureIndex: z.boolean().optional().describe("Refresh the local index automatically before searching. Defaults to true."),
        includePlan: z.boolean().optional().describe("Include the query plan explanation in the structured result.")
      },
      outputSchema: searchExecutionSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      const output = await runRegexSearch({
        workspaceRoot: args.workspaceRoot ?? defaults.workspaceRoot,
        indexDir: defaults.indexDir,
        pattern: args.pattern,
        flags: args.flags,
        pathGlobs: args.pathGlobs,
        maxResults: args.maxResults,
        beforeLines: args.beforeLines,
        afterLines: args.afterLines,
        autoEnsureIndex: args.autoEnsureIndex,
        includePlan: args.includePlan,
      });
      return result(output);
    },
  );
}
