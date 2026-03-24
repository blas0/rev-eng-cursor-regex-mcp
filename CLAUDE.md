## rev-eng-cursor-regex-mcp Guardrails

Use `rev-eng-cursor-regex-mcp://docs/decision-tree` as the canonical search policy.
Call `search.plan` first for reverse engineering, locating occurrences, grep-like work, and scoped repo search.
If `mustEnsureIndex` is true, call `index.ensure`.
Follow `recommendedSequence` exactly.
Use `search.literal` for exact identifiers, constants, env vars, filenames, and fixed strings.
Use `query.explain` before broad or uncertain regexes, then use `search.regex`.
If `plannerMode: full-scan-fallback` or `requiresFullScan: true`, narrow the pattern and add `pathGlobs`.
Use `document.inspect_terms` only for debugging poor plans or tokenization behavior.
Do not fall back to shell `rg` / `grep` / `fd` / `find` unless MCP results are insufficient or the task is an exact known-path lookup.
