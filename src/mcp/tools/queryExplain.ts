import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createQueryPlan } from "../../core/query/anchorExtraction.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the query planner explanation tool.
 */
export function registerQueryExplainTool(server: McpServer): void {
  server.registerTool(
    "query.explain",
    {
      title: "Explain Query Plan",
      description:
        "Explain how the server will decompose a query, what anchors it can extract, and whether the search will fall back to a full scan.",
      inputSchema: {
        pattern: z.string().describe("ECMAScript regular expression source without surrounding slashes."),
        flags: z.string().optional().describe("Optional ECMAScript regex flags."),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => result(createQueryPlan(args.pattern, args.flags ?? "")),
  );
}
