import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRevEngCursorRegexMcpServer } from "../mcp/server.js";
import { RuntimeConfig } from "../core/shared/types.js";

/**
 * Start the rev-eng-cursor-regex-mcp server over stdio.
 */
export async function runStdioServer(
  overrides: Partial<RuntimeConfig> = {},
): Promise<void> {
  const server = createRevEngCursorRegexMcpServer(overrides);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("rev-eng-cursor-regex-mcp running on stdio");
}
