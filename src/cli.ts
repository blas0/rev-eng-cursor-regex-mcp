#!/usr/bin/env node
import { runStdioServer } from "./entrypoints/stdio.js";
import { runHttpServer } from "./entrypoints/http.js";

function readFlagValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/**
 * Parse the small CLI surface used by local MCP clients and tests.
 */
async function main(): Promise<void> {
  const mode = process.argv[2] ?? "stdio";
  if (mode === "stdio") {
    await runStdioServer();
    return;
  }

  if (mode === "http") {
    const host = readFlagValue("--host");
    const port = readFlagValue("--port");
    await runHttpServer({
      httpHost: host,
      httpPort: port ? Number(port) : undefined,
    });
    return;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

main().catch((error) => {
  console.error("Fatal error in rev-eng-cursor-regex-mcp:", error);
  process.exit(1);
});
