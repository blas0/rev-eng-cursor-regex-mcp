# rev-eng-cursor-regex-mcp

`rev-eng-cursor-regex-mcp` is a portable TypeScript Model Context Protocol server for fast literal and regex search over local workspaces. It uses a sparse n-gram index for candidate pruning, then performs deterministic verification against the real file contents.

## Features

- `index.ensure`, `index.status`, and `index.clear` for local index lifecycle management
- Automatic `.gitignore` bootstrap for the local `.rev-eng-cursor-regex-mcp/` cache when that cache lives inside the workspace
- `search.literal` for exact-string search
- `search.regex` for ECMAScript regex search with sparse n-gram planning
- `query.explain` for anchor extraction and fallback analysis
- `document.inspect_terms` for trigram, masked-trigram, and sparse-term diagnostics
- Static resources for algorithm notes, storage layout, and agent workflow guidance
- Reusable prompts for investigation flow and regex refinement
- `stdio` and Streamable HTTP entrypoints

## Requirements

- Node.js 20 or newer

## Quick Start From Source

```bash
npm install
npm run build
npm run start:stdio
```

This starts the MCP server over stdio from a fresh clone with no global install required.

## Run Modes

Run over stdio from a local clone:

```bash
npm run start:stdio
```

Run over Streamable HTTP from a local clone:

```bash
npm run start:http
```

Run the built CLI directly:

```bash
node dist/cli.js stdio
node dist/cli.js http --host 127.0.0.1 --port 3333
```

Run without cloning after the package is published:

```bash
npx rev-eng-cursor-regex-mcp stdio
npx rev-eng-cursor-regex-mcp http --host 127.0.0.1 --port 3333
```

## Environment

- `REV_ENG_CURSOR_REGEX_MCP_WORKSPACE_ROOT`: default workspace root
- `REV_ENG_CURSOR_REGEX_MCP_INDEX_DIR`: parent directory where `.rev-eng-cursor-regex-mcp/` is created
- `REV_ENG_CURSOR_REGEX_MCP_BOOTSTRAP_GITIGNORE`: when set to `false`, `0`, `off`, or `no`, skip automatic `.gitignore` bootstrapping
- `REV_ENG_CURSOR_REGEX_MCP_HTTP_HOST`: default HTTP bind host
- `REV_ENG_CURSOR_REGEX_MCP_HTTP_PORT`: default HTTP bind port

## Verify A Fresh Clone

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Claude Desktop Example

```json
{
  "mcpServers": {
    "rev-eng-cursor-regex-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/rev-eng-cursor-regex-mcp/dist/cli.js",
        "stdio"
      ]
    }
  }
}
```

## Notes

- Git workspaces use a commit-keyed base index plus a mutable overlay for working-tree changes.
- `index.ensure` adds the cache directory to `.gitignore` automatically when the cache root lives inside the workspace. Pass `bootstrapGitignore: false` or set `REV_ENG_CURSOR_REGEX_MCP_BOOTSTRAP_GITIGNORE=false` to opt out.
- Non-git workspaces fall back to snapshot mode with `.gitignore`-style filtering.
- Ignore-case regex searches fall back to a deterministic full scan because the sparse index is case-sensitive.
