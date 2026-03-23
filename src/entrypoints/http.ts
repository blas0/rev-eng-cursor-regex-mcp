import express from "express";
import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createRevEngCursorRegexMcpServer } from "../mcp/server.js";
import { RuntimeConfig } from "../core/shared/types.js";
import { resolveRuntimeConfig } from "../core/shared/paths.js";

/**
 * Start the rev-eng-cursor-regex-mcp server over Streamable HTTP on `/mcp`.
 */
export async function runHttpServer(
  overrides: Partial<RuntimeConfig> = {},
): Promise<import("node:http").Server> {
  const config = resolveRuntimeConfig(overrides);
  const app = createMcpExpressApp({ host: config.httpHost });
  app.use(express.json({ limit: "5mb" }));

  const sessions = new Map<
    string,
    {
      transport: StreamableHTTPServerTransport;
      server: ReturnType<typeof createRevEngCursorRegexMcpServer>;
    }
  >();

  app.all("/mcp", async (req, res) => {
    const sessionHeader = req.header("mcp-session-id");
    let session = sessionHeader ? sessions.get(sessionHeader) : undefined;

    if (!session) {
      const server = createRevEngCursorRegexMcpServer(config);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
        }
      };
      await server.connect(transport);
      session = { server, transport };
    }

    await session.transport.handleRequest(req, res, req.body);
    if (session.transport.sessionId) {
      sessions.set(session.transport.sessionId, session);
    }
  });

  const nodeServer = app.listen(config.httpPort, config.httpHost);
  await new Promise<void>((resolve, reject) => {
    nodeServer.once("listening", () => resolve());
    nodeServer.once("error", reject);
  });
  return nodeServer;
}
