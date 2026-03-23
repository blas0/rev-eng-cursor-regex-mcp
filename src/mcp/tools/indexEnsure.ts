import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ensureIndex } from "../../core/index/manager.js";
import { IndexEnsureResponse, RuntimeConfig } from "../../core/shared/types.js";
import { indexEnsureResponseSchema } from "../schemas.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the index build-or-refresh tool.
 */
export function registerIndexEnsureTool(
  server: McpServer,
  defaults: Partial<RuntimeConfig>,
): void {
  server.registerTool(
    "index.ensure",
    {
      title: "Ensure Index",
      description:
        "Build or refresh the local regex index for a workspace and return the active base revision plus overlay state.",
      inputSchema: {
        workspaceRoot: z.string().optional().describe("Absolute workspace root to index. Defaults to the server workspace."),
        bootstrapGitignore: z.boolean().optional().describe("When true, add the cache directory to the workspace .gitignore if the cache lives inside the workspace. Defaults to true."),
        forceRebuild: z.boolean().optional().describe("Rebuild the immutable base index even when the active revision already exists."),
        includeGlobs: z.array(z.string()).optional().describe("Glob patterns that define which files belong to the corpus. Defaults to `**/*`."),
        excludeGlobs: z.array(z.string()).optional().describe("Glob patterns that should be excluded before indexing."),
        refreshOverlay: z.boolean().optional().describe("Refresh the writable overlay after resolving the base index. Defaults to true.")
      },
      outputSchema: indexEnsureResponseSchema,
      annotations: {
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      const startedAt = Date.now();
      const built = await ensureIndex({
        workspaceRoot: args.workspaceRoot ?? defaults.workspaceRoot,
        indexDir: defaults.indexDir,
        bootstrapGitignore: args.bootstrapGitignore ?? defaults.bootstrapGitignore,
        forceRebuild: args.forceRebuild,
        includeGlobs: args.includeGlobs,
        excludeGlobs: args.excludeGlobs,
        refreshOverlay: args.refreshOverlay,
      });

      const output: IndexEnsureResponse = {
        workspaceId: built.workspaceId,
        sourceMode: built.manifest.sourceMode,
        sourceRevision: built.manifest.sourceRevision,
        baseIndexId: built.manifest.baseIndexId,
        overlayRevision: built.manifest.overlay.revision,
        trackedFileCount: built.trackedFileCount,
        overlayFileCount: built.overlayFileCount,
        storageDir: built.storageDir,
        gitignorePath: built.gitignorePath,
        gitignoreEntry: built.gitignoreEntry,
        gitignoreUpdated: built.gitignoreUpdated,
        elapsedMs: Date.now() - startedAt,
      };

      return result(output);
    },
  );
}
