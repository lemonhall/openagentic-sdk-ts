# Tools (v2)

## Philosophy

Tools are argv-first and operate inside a constrained environment. In v2 demos we keep tools sandboxed (shadow workspace + constrained networking), while still providing a practical baseline toolset for real agent work.

For a full per-tool reference (inputs/outputs/examples), see: `docs/guide/tools/README.md`

## Currently enabled in demos

- `ListDir` — list a directory in the shadow workspace
- `Read` — read a file from the shadow workspace
- `Write` — create/overwrite a file in the shadow workspace
- `Edit` — precise string replace in a file
- `Glob` — find files by glob pattern
- `Grep` — search file contents by regex
- `Bash` — restricted shell over the shadow workspace (pipes/redirection; not host bash)
- `WebFetch` — fetch an http(s) URL (cookies omitted; may be limited by browser CORS)
- `TodoWrite` — write/update a TODO list (used for planning/UX)
- `SlashCommand` — load `.claude/commands/<name>.md` from the shadow workspace
- `Skill` — load a built-in skill by name

Node demo only (requires a server-side key):

- `WebSearch` — Tavily web search (requires `TAVILY_API_KEY`)

## Shell tools

`Command` / `Shell` over WASI are implemented in the SDK and power the WASI-backed `Bash` tool in the demos (when enabled). They require:

- a WASI runner (browser worker runner or server `wasmtime` runner)
- signed bundles installed from an official bundle base URL / registry

The TS-native tools remain available as a fallback.
