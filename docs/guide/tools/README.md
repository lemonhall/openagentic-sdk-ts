# Tools Reference

This SDK ships a baseline toolset that is designed to work with the **shadow workspace** model (tools see only the shadow FS; real files are written back only on explicit “commit” actions in the demos).

## Conventions

- **Paths are workspace-relative** (no drive letters, no `/`, no `..` traversal).
- Text is UTF-8 unless explicitly stated.
- Hosts may gate tools via permissions; the demos auto-approve.
- Browser networking uses `fetch(..., { credentials: "omit" })` (no cookies).
- As of v13 (2026-01-28), this repo **abandons WASI toolchains/bundles/registries**; older “bundle distro” plans are kept only for historical context.

## File + Workspace Tools

See: `files.md`

- `Read` / `Write` / `Edit`
- `ListDir` / `Glob` / `Grep`

## Shell Tool

See: `bash.md`

- `Bash` — a shell over the shadow workspace (TS-native in browser; host-native in Node/server)

## Language Tools

As of v13 (2026-01-28), the WASI Python toolchain direction is abandoned and this SDK does not ship a `Python` tool.

## Web Tools

See: `web.md`

- `WebFetch`
- `WebSearch` (Tavily; requires `TAVILY_API_KEY`, typically enabled server-side; not enabled in the browser demo by default)

## Meta / Coordination Tools

See: `meta.md`

- `TodoWrite`
- `SlashCommand` (loads `.claude/commands/<name>.md` from the shadow workspace)
- `Skill` (loads built-in skills by `name`)
