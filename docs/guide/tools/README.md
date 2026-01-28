# Tools Reference

This SDK ships a baseline toolset that is designed to work with the **shadow workspace** model (tools see only the shadow FS; real files are written back only on explicit “commit” actions in the demos).

## Conventions

- **Paths are workspace-relative** (no drive letters, no `/`, no `..` traversal).
- Text is UTF-8 unless explicitly stated.
- Hosts may gate tools via permissions; the demos auto-approve.
- Browser networking uses `fetch(..., { credentials: "omit" })` (no cookies).
- Tool bundles should be installed from **official registries** and verified (sha256 + signatures).

## File + Workspace Tools

See: `files.md`

- `Read` / `Write` / `Edit`
- `ListDir` / `Glob` / `Grep`

## Shell Tool

See: `bash.md`

- `Bash` — a restricted shell over the shadow workspace (pipes + redirects, but **not** host bash)

## Language Tools

See: `python.md`

- `Python` — run Python code in a WASI runtime bundle (currently a minimal demo bundle; opt-in in demos)

## Web Tools

See: `web.md`

- `WebFetch`
- `WebSearch` (Tavily; requires `TAVILY_API_KEY`, typically enabled server-side; not enabled in the browser demo by default)

## Meta / Coordination Tools

See: `meta.md`

- `TodoWrite`
- `SlashCommand` (loads `.claude/commands/<name>.md` from the shadow workspace)
- `Skill` (loads built-in skills by `name`)
