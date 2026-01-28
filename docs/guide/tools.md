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
- `Bash` — shell over the shadow workspace (TS-native in browser; host-native in Node/server)
- `WebFetch` — fetch an http(s) URL (cookies omitted; may be limited by browser CORS)
- `TodoWrite` — write/update a TODO list (used for planning/UX)
- `SlashCommand` — load `.claude/commands/<name>.md` from the shadow workspace
- `Skill` — load a built-in skill by name

## Optional (opt-in)

Node demo only (requires a server-side key):

- `WebSearch` — Tavily web search (requires `TAVILY_API_KEY`)

## Shell tools

The browser demo’s `Bash` is a restricted TS-native shell. The Node demo’s `Bash` is host-native `bash` under a sandbox backend (when available). v13 treats “what exists” as an explicit contract and stops chasing “infinite distro parity”.
