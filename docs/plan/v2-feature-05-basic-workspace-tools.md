# v2 Feature 05: Basic Workspace Tools (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Give the agent non-WASI tools to operate on the shadow workspace (so it’s useful even before a full WASI tool bundle exists).

## Goal

Add tools (in `@openagentic/tools` or a new `@openagentic/tools-workspace` package):

- `ReadFile` — read a text/binary file from the shadow workspace
- `WriteFile` — write/overwrite a file in the shadow workspace
- `ListDir` — list directory entries
- `Glob` — simple glob over workspace paths
- `Grep` — search text patterns across workspace files

All tools must:

- operate **only** on the provided `workspace` in `ToolContext`
- be permission-gated by the host (ToolRunner already handles this)

## Task 1: Read/Write/List tools

**Files:**
- Create: `packages/tools/src/workspace/read-file.ts`
- Create: `packages/tools/src/workspace/write-file.ts`
- Create: `packages/tools/src/workspace/list-dir.ts`
- Modify: `packages/tools/src/index.ts`
- Test: `packages/tools/src/__tests__/workspace-tools.test.ts`

**Step 1: Write failing tests (MemoryWorkspace)**

- Create a `MemoryWorkspace`, write `a.txt`, then `ReadFile` returns contents
- `WriteFile` creates/overwrites files
- `ListDir` returns deterministic entries

Run: `pnpm -C packages/tools test`  
Expected: FAIL

**Step 2: Implement minimal tools**

Use `@openagentic/workspace` APIs only.

**Step 3: Run tests**

Run: `pnpm -C packages/tools test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(tools): add workspace file tools`

## Task 2: Glob + Grep

**Files:**
- Create: `packages/tools/src/workspace/glob.ts`
- Create: `packages/tools/src/workspace/grep.ts`
- Modify: `packages/tools/src/index.ts`
- Test: `packages/tools/src/__tests__/workspace-glob-grep.test.ts`

**Acceptance:**
- `Glob` supports `**/*` and `*.ts`-style patterns (document exact subset)
- `Grep` supports plain substring search (regex optional, but define clearly)

**Commit message:** `feat(tools): add workspace glob/grep`

