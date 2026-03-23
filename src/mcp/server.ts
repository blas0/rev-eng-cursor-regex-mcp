import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RuntimeConfig } from "../core/shared/types.js";
import { resolveRuntimeConfig } from "../core/shared/paths.js";
import { registerIndexEnsureTool } from "./tools/indexEnsure.js";
import { registerIndexStatusTool } from "./tools/indexStatus.js";
import { registerIndexClearTool } from "./tools/indexClear.js";
import { registerSearchLiteralTool } from "./tools/searchLiteral.js";
import { registerSearchRegexTool } from "./tools/searchRegex.js";
import { registerQueryExplainTool } from "./tools/queryExplain.js";
import { registerDocumentInspectTermsTool } from "./tools/documentInspectTerms.js";
import { readAlgorithmsResource } from "./resources/docsAlgorithms.js";
import { readStorageResource } from "./resources/docsStorage.js";
import { readUsagePlaybookResource } from "./resources/docsUsagePlaybook.js";
import {
  listWorkspaceManifestResources,
  readWorkspaceManifestResource,
} from "./resources/workspaceManifest.js";
import {
  listWorkspaceStatsResources,
  readWorkspaceStatsResource,
} from "./resources/workspaceStats.js";
import { getInvestigateWithRevEngCursorRegexMcpPrompt } from "./prompts/investigateWithRevEngCursorRegexMcp.js";
import { getRefineRegexPatternPrompt } from "./prompts/refineRegexPattern.js";
import * as z from "zod/v4";

/**
 * Create the fully registered rev-eng-cursor-regex-mcp server.
 */
export function createRevEngCursorRegexMcpServer(
  overrides: Partial<RuntimeConfig> = {},
): McpServer {
  const config = resolveRuntimeConfig(overrides);
  const server = new McpServer(
    {
      name: "rev-eng-cursor-regex-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  registerIndexEnsureTool(server, config);
  registerIndexStatusTool(server, config);
  registerIndexClearTool(server, config);
  registerSearchLiteralTool(server, config);
  registerSearchRegexTool(server, config);
  registerQueryExplainTool(server);
  registerDocumentInspectTermsTool(server, config);

  server.registerResource(
    "docs-algorithms",
    "rev-eng-cursor-regex-mcp://docs/algorithms",
    {
      title: "Algorithm Overview",
      description: "Blog-to-server mapping for classic trigrams, masked trigrams, suffix arrays, and sparse n-grams.",
      mimeType: "text/markdown",
    },
    readAlgorithmsResource,
  );

  server.registerResource(
    "docs-storage-layout",
    "rev-eng-cursor-regex-mcp://docs/storage-layout",
    {
      title: "Storage Layout",
      description: "Exact on-disk layout for manifests, lookup tables, postings, and overlays.",
      mimeType: "text/markdown",
    },
    readStorageResource,
  );

  server.registerResource(
    "docs-usage-playbook",
    "rev-eng-cursor-regex-mcp://docs/usage-playbook",
    {
      title: "Usage Playbook",
      description:
        "Recommended agent workflow and failure-handling guidance for the rev-eng-cursor-regex-mcp server.",
      mimeType: "text/markdown",
    },
    readUsagePlaybookResource,
  );

  server.registerResource(
    "workspace-manifest",
    new ResourceTemplate(
      "rev-eng-cursor-regex-mcp://workspace/{workspaceId}/manifest",
      {
      list: async () => listWorkspaceManifestResources(config.indexDir),
      },
    ),
    {
      title: "Workspace Manifest",
      description: "Read the active manifest and revision metadata for a workspace.",
      mimeType: "application/json",
    },
    async (uri, params) =>
      readWorkspaceManifestResource(config.indexDir, uri, params as { workspaceId: string }),
  );

  server.registerResource(
    "workspace-stats",
    new ResourceTemplate(
      "rev-eng-cursor-regex-mcp://workspace/{workspaceId}/stats",
      {
      list: async () => listWorkspaceStatsResources(config.indexDir),
      },
    ),
    {
      title: "Workspace Stats",
      description: "Read the active index counts, sizes, and overlay summary for a workspace.",
      mimeType: "application/json",
    },
    async (uri, params) =>
      readWorkspaceStatsResource(config.indexDir, uri, params as { workspaceId: string }),
  );

  server.registerPrompt(
    "investigate-with-rev-eng-cursor-regex-mcp",
    {
      title: "Investigate With rev-eng-cursor-regex-mcp",
      description: "Guide an agent through ensure, explain, search, and narrowing steps.",
      argsSchema: {
        objective: z.string().describe("What the agent is trying to investigate."),
        suspectedPattern: z.string().optional().describe("Optional first-pass search pattern or identifier."),
      },
    },
    getInvestigateWithRevEngCursorRegexMcpPrompt,
  );

  server.registerPrompt(
    "refine-regex-pattern",
    {
      title: "Refine Regex Pattern",
      description: "Rewrite a broad regex into one that keeps stronger literal anchors for sparse planning.",
      argsSchema: {
        pattern: z.string().describe("The ECMAScript regex source to refine."),
        goal: z.string().optional().describe("Optional explanation of what the refined regex should preserve."),
      },
    },
    getRefineRegexPatternPrompt,
  );

  return server;
}
