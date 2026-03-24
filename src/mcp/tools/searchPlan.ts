import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { buildSearchPlan } from "../../core/query/searchPlan.js";
import { RuntimeConfig } from "../../core/shared/types.js";
import { searchPlanResponseSchema } from "../schemas.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the workflow planning tool that chooses the next MCP search action.
 */
export function registerSearchPlanTool(
  server: McpServer,
  defaults: Partial<RuntimeConfig>,
): void {
  server.registerTool(
    "search.plan",
    {
      title: "Plan Search Workflow",
      description:
        "Plan the MCP-first search workflow for an exploratory objective and recommend whether to ensure the index, use literal search, explain a regex, or run regex search.",
      inputSchema: {
        workspaceRoot: z.string().optional().describe("Absolute workspace root to plan against. Defaults to the server workspace."),
        objective: z.string().describe("Plain-language explanation of what the agent is trying to locate."),
        suspectedPattern: z.string().optional().describe("Optional first-pass regex or identifier candidate to plan around."),
        knownExactString: z.string().optional().describe("Optional exact string to search for when it is already known."),
        pathHints: z.array(z.string()).optional().describe("Optional folders, packages, or relative path globs that should scope the suggested search."),
      },
      outputSchema: searchPlanResponseSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> =>
      result(
        await buildSearchPlan({
          workspaceRoot: args.workspaceRoot ?? defaults.workspaceRoot,
          indexDir: defaults.indexDir,
          objective: args.objective,
          suspectedPattern: args.suspectedPattern,
          knownExactString: args.knownExactString,
          pathHints: args.pathHints,
        }),
      ),
  );
}
