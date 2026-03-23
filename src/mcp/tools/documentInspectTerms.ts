import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { inspectTerms } from "../../core/query/termInspection.js";
import { RuntimeConfig } from "../../core/shared/types.js";

function result<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    structuredContent: output as unknown as Record<string, unknown>,
  };
}

/**
 * Register the document term inspection tool.
 */
export function registerDocumentInspectTermsTool(
  server: McpServer,
  defaults: Partial<RuntimeConfig>,
): void {
  server.registerTool(
    "document.inspect_terms",
    {
      title: "Inspect Terms",
      description:
        "Show the trigrams or sparse n-grams that would be emitted for a file or text snippet, including offsets and rarity weights.",
      inputSchema: {
        path: z.string().optional().describe("Absolute path to the source file to inspect."),
        text: z.string().optional().describe("Inline text snippet to inspect instead of reading a file."),
        mode: z.enum(["sparse", "trigram", "masked-trigram"]).describe("Choose the tokenization mode to inspect."),
        maxTerms: z.number().int().positive().optional().describe("Maximum number of emitted terms to return. Defaults to 256.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args): Promise<CallToolResult> => {
      const filePath =
        args.path && !args.path.startsWith("/")
          ? `${defaults.workspaceRoot ?? process.cwd()}/${args.path}`
          : args.path;
      return result(
        await inspectTerms({
          path: filePath,
          text: args.text,
          mode: args.mode,
          maxTerms: args.maxTerms,
        }),
      );
    },
  );
}
