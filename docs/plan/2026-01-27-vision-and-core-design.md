# OpenAgentic SDK TS — Vision & Core Design

Date: 2026-01-27  
Updated: 2026-01-28 (v13 pivot)

## Vision

Port the Python `openagentic-sdk` core runtime into **pure TypeScript**, keeping:

- a real tool loop (LLM requests tools → permission gate → tool execution → tool results → continue)
- event-sourced sessions (durable logs, resumable via `session_id`)
- a tool-first SDK surface that works across browser + server

and provide a practical “Bash-like” toolchain over a **shadow workspace**:

- **Browser:** TS-native tools over OPFS (deterministic, finite)
- **Server:** host-native execution under an OS sandbox (pragmatic, more powerful)

## Constraints (non-negotiables)

- **Shadow workspace:** the agent never directly mutates the user’s real filesystem.
  - Browser: the agent sees only a shadow workspace stored in **OPFS** (Origin Private File System).
  - Real filesystem access (File System Access API) is used only at explicit boundaries: import and commit.
- **Deterministic auditability:** all tool use, permissions, and tool I/O are recorded as events.
- **Finite contracts:** tool behavior and availability must be explicit and match reality (especially `Bash`).
- **Network safety:** all SDK fetches default to `credentials: "omit"` (no cookies).
- **Defense in depth (server):** sandbox backends (Bubblewrap/nsjail/sandbox-exec/jobobject) may be used to harden host-native execution.

## Success criteria (v1)

- A minimal agent runtime in TS that can run a multi-step tool loop and persist/replay sessions.
- Browser: import a local folder → run tools only against shadow OPFS → produce a reviewable changeset → user approves commit → apply to real folder.
- Node/server: run tools against a shadow workspace directory and support optional OS sandbox hardening.

## Status (as of v13 — current repo reality)

The repo has a runnable end-to-end agent slice (Node + browser):

- Event-sourced sessions + resumable runtime loop (multi-turn + tool calling + streaming).
- Shadow workspace abstractions (Memory/OPFS/LocalDir) with explicit import/commit boundaries.
- Browser runnable demo: OPFS shadow workspace + OpenAI-compatible backend via local proxy (no cookies).
- Node runnable demo: shadow workspace + real OpenAI call; `/status` + `/commit` boundary.
- A baseline TS toolset operating on the shadow workspace (`Read/Write/Edit/Glob/Grep/Bash/WebFetch/...`).
- Server hardening backends for native execution (best-effort, OS-dependent).

## v13 Pivot (hard decision)

As of **2026-01-28**, we explicitly abandon the WASI toolchain direction:

- no WASI runners on the default path
- no bundles/registry installation story
- no “same semantics across browser/server via WASI execution” as a top-level goal

Rationale: the WASI direction repeatedly pulled the project into a high-effort “Linux userland compatibility” loop, and “just run BusyBox in WASM” is not a reliable escape hatch for our constraints.

## Core architecture (current)

### Tools as core

Tools are first-class and are executed only through:

`ToolCall → PermissionGate → ToolRunner → ToolResult`

No “direct access” escape hatches.

### Event-sourced sessions

Events are the source of truth (representative types):

- `system.init`
- `user.message`
- `assistant.delta` (optional streaming)
- `assistant.message`
- `tool.use`
- `tool.result`
- `permission.question` / `permission.decision` (or equivalent)
- `workspace.import` / `workspace.commit` / `workspace.diff` (recommended)
- `result`

### Shadow workspace + commit transaction

Browser flow:

1. User selects a real folder via File System Access API.
2. SDK imports/syncs it into an OPFS workspace (shadow).
3. All tools operate only on the shadow workspace.
4. SDK computes a change set (adds/deletes/modifies + optional diffs).
5. UI renders the change set for review; user approves.
6. SDK applies the change set to the real folder (commit).

This isolates destructive operations and enables audit/review.

## Future extensions (explicitly out of v1)

- Richer agent orchestration UI and task tooling.
- More complete browser-side shell semantics (only if it remains worth the complexity).
- Stronger server sandboxing backends and operator-friendly policy configs.

