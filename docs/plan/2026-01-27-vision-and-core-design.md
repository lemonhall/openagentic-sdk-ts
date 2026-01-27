# OpenAgentic SDK TS — Vision & Core Design

Date: 2026-01-27

## Vision

Port the Python `openagentic-sdk` core runtime into **pure TypeScript**, keeping:

- A real tool loop (LLM requests tools → permission gate → tool execution → tool results → continue)
- Event-sourced sessions (durable logs, resumable via `session_id`)
- A tool-first SDK surface that works across browser + server

and adding a first-class, sandboxed, WASI-based “Bash-like” toolchain that runs with **the same semantics** in:

- Browser (WebWorker + web WASI shim)
- Server (WASI host such as `wasmtime`)

## Constraints (non-negotiables)

- **Shadow workspace**: the agent never directly mutates the user’s real filesystem.
  - In the browser, the agent sees only a shadow workspace stored in **OPFS** (Origin Private File System).
  - Real filesystem access (File System Access API) is used only at explicit boundaries: import and commit.
- **Deterministic auditability**: all tool use, permissions, and sandboxed I/O are recorded as events.
- **Same semantics across browser/server**: “shell behavior” is implemented in TS host logic, not by relying on an OS shell.
- **Bash is core**: a Bash-like experience is achieved via WASI tool execution + a `Shell(script)` compiler.
- **Network is allowed for WASI tools** (runner-injected `fetch`), but **must not** use user cookies/credentials.

## Success criteria (v1)

- A minimal agent runtime in TS that can run a multi-step tool loop and persist/replay sessions.
- Browser: import a local folder → run tools only against shadow OPFS → produce a reviewable changeset → user approves commit → apply to real folder.
- A WASI-based tool execution layer with:
  - `Command(argv)` (structured)
  - `Shell(script)` (shell subset B: pipelines + redirects + `&&/||` + `$VAR` + simple glob)
- Tool bundles installable from an official registry with **signature + sha256** verification.
- WASI network via injected `fetch` with `credentials: "omit"` by default.
- Permission gating default: **ask once per session, then auto-allow** (user can revoke/reset).

## Status (as of v2 — current repo reality)

The repo now has a runnable end-to-end agent slice (Node + browser) and a “real” baseline toolset, but it is **not yet WASI-first** by default.

**Implemented (v1 + v2):**

- Event-sourced sessions + resumable runtime loop (multi-turn + tool calling + streaming).
- Shadow workspace abstractions (Memory/OPFS/LocalDir) with explicit import/commit boundaries.
- Browser runnable demo: OPFS shadow workspace + OpenAI-compatible backend via local proxy (no cookies).
- Node runnable demo: shadow workspace + real OpenAI call; `/status` + `/commit` boundary.
- “Claude-style” baseline tools in pure TS (`Read/Write/Edit/Glob/Grep/Bash/WebFetch/WebSearch/TodoWrite/SlashCommand/Skill`), operating on the shadow workspace.

**Present and used by default in demos:**

- WASI runners (`@openagentic/wasi-runner-web`, `@openagentic/wasi-runner-wasmtime`).
- WASI bundle plumbing (`@openagentic/bundles`) and WASI tools (`Command(argv)`, `Shell(script)`).

## The WASI gap (what’s still missing vs the original “same semantics WASI runner” story)

The high-level architecture remains valid, but several pieces are still “prototype-grade” or disconnected from the default runnable path:

- **WASI network capability is still incomplete**: the `netFetch` capability exists in types/utilities, but runners/tools do not yet expose it end-to-end to WASI modules with consistent policy + auditing.
- **Python is partially delivered**: the `Python` tool + `lang-python` bundle wiring exists, but the shipped demo runtime is currently a minimal placeholder WASI module. A real MicroPython/CPython WASI runtime bundle + packaging policy is still tracked.

## Core architecture (recommended)

### Layering

1. **Core runtime (portable)**: events, session store, tool loop, permission gate, provider abstraction.
2. **Workspace**: shadow filesystem abstraction + change tracking + import/commit boundary.
3. **Tools**: tool registry and a set of default portable tools (`Read/Write/Edit/Glob/Grep`, etc.) that operate on the Workspace.
4. **WASI runner**:
   - `runner-web`: executes WASI modules in WebWorker using a web WASI shim, with OPFS-backed FS.
   - `runner-wasmtime`: executes WASI modules via `wasmtime` (server), preopening only the shadow workspace.
5. **Tool bundles**: manifests, install, cache, integrity verification.
6. **Bash-like tools**:
   - `Command(argv)`: direct WASI execution.
   - `Shell(script)`: TS host parses and compiles shell syntax into a pipeline plan, executing steps via `Command`.

### Event-sourced sessions

Events are the source of truth:

- `system.init`
- `user.message`
- `assistant.delta` (optional streaming)
- `assistant.message`
- `tool.use`
- `tool.result`
- `permission.question` / `permission.decision` (or equivalent)
- `workspace.import` / `workspace.commit` / `workspace.diff` (recommended)
- `result`

Sessions can be resumed by replaying and rebuilding provider input (legacy chat or Responses-style input).

### Shadow workspace + commit transaction

Browser flow:

1. User selects a real folder via File System Access API.
2. SDK imports/syncs it into an OPFS workspace (shadow).
3. All tools (including WASI commands) operate only on the shadow workspace.
4. When done, SDK computes a change set (adds/deletes/modifies + optional diffs).
5. UI renders the change set for review; user approves.
6. SDK applies the change set to the real folder (commit).

This isolates destructive operations and enables audit/review.

### Tools as core

Tools are first-class and are executed only through:

`ToolCall → PermissionGate → ToolRunner → ToolResult`

No “direct access” escape hatches.

### `Command` and `Shell`

#### `Command(argv)` (primary)

Structured execution:

- Input: `{ argv: string[], cwd?: string, env?: Record<string,string>, stdin?: bytes|string, limits: {...} }`
- Output: `{ exitCode: number, stdout: string|bytes, stderr: string|bytes, truncated: boolean, meta: {...} }`

#### `Shell(script)` (secondary, compiled)

Shell is implemented as a **restricted shell subset** (B):

- Supported: pipelines `|`, redirects `< > >>`, conditionals `&& ||`, basic quoting, `$VAR`, simple globs.
- Not supported (v1): heredoc, subshells, command substitution, job control, complex brace/parameter expansion.

`Shell` compiles `script` into a pipeline graph and executes steps via `Command(argv)`.

### WASI network (injected `fetch`)

WASI modules do not get raw sockets. They receive a host-injected `fetch` capability:

- Default policy: allow all destinations, with strict limits (timeouts, max bytes, concurrency).
- Browser default: `credentials: "omit"` (never touch user cookies/session).
- All requests/responses are audited as events (sanitized headers, sizes, timings).

## Tool bundles & registry

### Bundles

A Tool Bundle is a set of WASI modules + a signed/hashed manifest:

- `manifest.json` lists commands, module paths, sizes, sha256, and recommended limits.
- Multiple bundles are supported (e.g., `core-utils`, `data-utils`, `lang-python`).

### Registry

- Official registry: signature + sha256 verification is mandatory.
- Third-party registries: sha256 verification is required; signatures optional (user-provided keys). Not supported/warranted.

Browser caches bundles in OPFS; server caches them in a configured local directory.

## Open questions (track before implementation)

- Provider API surface: match Python (`query/run/query_messages`) vs. TS-idiomatic streaming primitives.
- Exact event schema: JSONL portability, forward compatibility, and compacting strategy.
- WASI in browser: choose a shim/runtime and define the hostcall surface (FS + fetch + time + randomness).
- Python-in-WASI expectations: footprint, stdlib coverage, package management policy, and limits (tracked as `docs/plan/v3-feature-06-python-runtime-bundle.md`).

## Next milestone (v3)

Make the default “Bash-like” experience **WASI-first** (bundles + runners) while keeping the v2 runnable slice intact. See `docs/plan/v3-index.md`.

## Future extensions (explicitly out of v1)

- `Shell` advanced syntax: heredoc, subshells, command substitution, arrays, functions.
- Multi-agent orchestration UI and richer task tooling.
- Deterministic replay with recorded tool outputs (for offline simulation).
- Fine-grained network allowlists and policy DSLs.
