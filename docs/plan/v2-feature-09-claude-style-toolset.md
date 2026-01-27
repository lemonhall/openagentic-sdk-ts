# v2 Feature 09: “Claude-style” Toolset Parity (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Make the TS SDK’s default toolset feel “real” (comparable to the Python SDK / common agent tool prompts), so an agent can actually do multi-step work with files + search + shell-like scripting + web fetch/search.

## Problem / Current State

In `openagentic-sdk-ts` today, the runnable demos mostly register only:

- `ReadFile`
- `WriteFile`
- `ListDir`

The Python SDK (`/mnt/e/development/openagentic-sdk/openagentic_sdk/tools/*`) includes a more complete “agent baseline” toolset:

- `Read`, `Write`, `Edit`
- `Glob`, `Grep`
- `Bash`
- `WebFetch`
- `WebSearch` (Tavily)
- `TodoWrite`
- `SlashCommand` (load `.claude/commands/<name>.md`)
- `Skill` (load skills by name; available skills listed in tool description)

Without these, agents are “too weak” and have to hallucinate capabilities.

## Constraints / Non-goals

- Tools must operate on the **shadow workspace** (`ToolContext.workspace`) by default.
- Browser must not send cookies (`fetch(..., { credentials: "omit" })`).
- `Bash` is **not** “host bash”; it must run in a restricted environment (shadow workspace). v3 can add a richer WASI tool bundle.
- Keep the implementation dependency-light (avoid pulling in large glob/grep libs unless necessary).

## Design Options

### Option A — “WASI-first Bash”

- Implement `Bash` as `Shell(script)` → `Command(argv)` over WASI bundles.
- Pros: long-term alignment with the WASI sandbox story.
- Cons: requires a large, mature bundle set (busybox/coreutils/grep/find/etc). Today we only ship a tiny sample bundle, so `Bash` would be unusable.

### Option B — “Workspace-native Bash (builtins)”

- Implement `Bash` as a **small shell interpreter** with built-in commands implemented in TypeScript over `Workspace`.
- Pros: works in browser + Node immediately; no bundle dependencies; consistent “shadow FS” semantics.
- Cons: not full bash; command set is limited and must be defined.

### Option C — “No Bash (force argv tools)”

- Implement `Command(argv)` only and push the model toward argv-based tools.
- Pros: simplest surface area.
- Cons: contradicts the user requirement that `Bash`/pipes/redirection are “core of core”.

**Recommended:** Option B for v2 (make it runnable now), keep Option A as v3 upgrade (swap builtins for WASI modules / add `busybox`-style bundles).

## Scope for v2 (what we implement now)

In `@openagentic/tools`:

1. **Filesystem tools (workspace-based)**
   - `Read` (file + optional offset/limit; utf-8; max bytes)
   - `Write` (overwrite gating via `overwrite`)
   - `Edit` (string replace with optional anchors; `count`/`replace_all`)
   - `Glob` (workspace glob subset)
   - `Grep` (regex-like or substring; define subset; max matches)
   - Keep existing `ReadFile`/`WriteFile`/`ListDir` for compatibility (demos may migrate to new names).

2. **Shell tool**
   - `Bash` that accepts `{ command: string, cwd?: string, env?: object }`
   - Supports: pipes (`|`), `&&`/`||`, `<`, `>`, `>>`, `$VAR` expansion, `*` globs
   - Built-in commands (v2): `echo`, `cat`, `ls`, `pwd`, `mkdir`, `rm`, `cp`, `mv`, `grep`

3. **Web tools**
   - `WebFetch` (http/https only, redirect limit, block localhost/private-ish hosts best-effort)
   - `WebSearch` (Tavily; require `TAVILY_API_KEY` or proxy-based backend in demos)

4. **Coordination tools**
   - `TodoWrite` (validate + return stats; optional host UI can display)
   - `SlashCommand` (load `.claude/commands/<name>.md` from workspace)
   - `Skill` (load built-in skills shipped by the SDK; list available in description)

## Execution Plan (TDD + small commits)

### Task 1: Add `Read` / `Write` / `Edit` tools

**Files:**
- Create: `packages/tools/src/claude/read.ts`
- Create: `packages/tools/src/claude/write.ts`
- Create: `packages/tools/src/claude/edit.ts`
- Test: `packages/tools/src/__tests__/claude-fs-tools.test.ts`
- Modify: `packages/tools/src/index.ts`

**Acceptance:**
- Inputs match Python tool keys (`file_path` + back-compat aliases)
- All ops go through `ctx.workspace`

**Commit:** `feat(tools): add Read/Write/Edit`

### Task 2: Add `Glob` / `Grep` tools (workspace-based)

**Files:**
- Create: `packages/tools/src/claude/glob.ts`
- Create: `packages/tools/src/claude/grep.ts`
- Test: `packages/tools/src/__tests__/claude-glob-grep.test.ts`
- Modify: `packages/tools/src/index.ts`

**Acceptance:**
- Deterministic ordering
- Hard caps (max files scanned / max matches) to avoid hanging on large workspaces

**Commit:** `feat(tools): add Glob/Grep`

### Task 3: Implement `Bash` (workspace-native builtins)

**Files:**
- Modify: `packages/tools/src/shell/exec.ts` (allow injected runner, keep existing tests green)
- Create: `packages/tools/src/bash/builtins.ts`
- Create: `packages/tools/src/bash/bash.ts`
- Test: `packages/tools/src/__tests__/bash-tool.test.ts`
- Modify: `packages/tools/src/index.ts`

**Acceptance:**
- `Bash` can run `echo | cat`, `ls`, `grep "x" *.txt`, and redirects against `MemoryWorkspace`

**Commit:** `feat(tools): add Bash (workspace shell)`

### Task 4: Implement `WebFetch` / `WebSearch`

**Files:**
- Create: `packages/tools/src/web/web-fetch.ts`
- Create: `packages/tools/src/web/web-search.ts`
- Test: `packages/tools/src/__tests__/web-tools.test.ts`
- Modify: `packages/tools/src/index.ts`

**Acceptance:**
- Credentials omitted
- Blocks obvious localhost/private-ish destinations
- Tavily request shape aligns with Python tool

**Commit:** `feat(tools): add WebFetch/WebSearch`

### Task 5: Implement `TodoWrite` / `SlashCommand` / `Skill`

**Files:**
- Create: `packages/tools/src/claude/todo-write.ts`
- Create: `packages/tools/src/claude/slash-command.ts`
- Create: `packages/tools/src/claude/skill.ts`
- Create: `packages/tools/src/claude/skills/builtin.ts`
- Test: `packages/tools/src/__tests__/claude-meta-tools.test.ts`
- Modify: `packages/tools/src/index.ts`

**Commit:** `feat(tools): add TodoWrite/SlashCommand/Skill`

### Task 6: Wire demos to register the full toolset + docs

**Files:**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `docs/guide/quickstart-node.md`
- Modify: `docs/guide/quickstart-browser.md`

**Commit:** `feat(demo): register full toolset`

