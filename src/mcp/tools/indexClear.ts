import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { clearIndex } from "../../core/index/manager.js";
import { IndexClearResponse, RuntimeConfig } from "../../core/shared/types.js";
import { indexClearResponseSchema } from "../schemas.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the cache reset tool.
 */
export function registerIndexClearTool(
  server: McpServer,
  defaults: Partial<RuntimeConfig>,
): void {
  server.registerTool(
    "index.clear",
    {
      title: "Clear Index",
      description:
        "Delete cached index data for a workspace. Use this only to recover from stale or corrupt local index state.",
      inputSchema: {
        workspaceRoot: z.string().optional().describe("Absolute workspace root whose cache should be cleared. Defaults to the server workspace."),
        scope: z.enum(["overlay", "all"]).describe("Choose `overlay` to drop only the mutable layer or `all` to remove the entire local cache."),
      },
      outputSchema: indexClearResponseSchema,
      annotations: {
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      const startedAt = Date.now();
      const cleared = await clearIndex({
        workspaceRoot: args.workspaceRoot ?? defaults.workspaceRoot,
        indexDir: defaults.indexDir,
        scope: args.scope,
      });
      const output: IndexClearResponse = {
        clearedScope: args.scope,
        removedPaths: cleared.removedPaths,
        storageDir: cleared.storageDir,
        elapsedMs: Date.now() - startedAt,
      };
      return result(output);
    },
  );
}
