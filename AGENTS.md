## rev-eng-cursor-regex-mcp Usage

Use `search.literal` for exact identifiers, constants, env vars, filenames, and fixed strings.
Use `search.regex` only when you need real regex syntax.
Call `index.ensure` once at the start of a workspace session and again after large edit bursts, branch changes, or if search reports stale index state.
Call `query.explain` before broad regexes that use alternation, character classes, or heavy quantifiers.
Pass `pathGlobs` whenever you already know the subsystem, package, or folder you care about.
If `search.regex` reports `plannerMode: full-scan-fallback`, narrow the pattern before retrying.
Use `document.inspect_terms` only for debugging how the index tokenizes content or why a query plans poorly.
Do not call `index.clear` unless the local cache is stale, corrupt, or you are explicitly resetting the index.
