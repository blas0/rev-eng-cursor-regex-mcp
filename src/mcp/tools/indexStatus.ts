import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getIndexStatus } from "../../core/index/manager.js";
import { RuntimeConfig } from "../../core/shared/types.js";
import { indexStatusResponseSchema } from "../schemas.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the read-only index status tool.
 */
export function registerIndexStatusTool(
  server: McpServer,
  defaults: Partial<RuntimeConfig>,
): void {
  server.registerTool(
    "index.status",
    {
      title: "Index Status",
      description:
        "Describe the active regex index for a workspace, including corpus selection, freshness, and storage paths, without rebuilding it.",
      inputSchema: {
        workspaceRoot: z.string().optional().describe("Absolute workspace root to inspect. Defaults to the server workspace."),
      },
      outputSchema: indexStatusResponseSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      const status = await getIndexStatus({
        workspaceRoot: args.workspaceRoot ?? defaults.workspaceRoot,
        indexDir: defaults.indexDir,
      });
      return result(status);
    },
  );
}
