# v3 Feature 02: Node WASI via `wasmtime` + Shadow Directory Workspace (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Make server-side WASI execution mount the shadow workspace as a preopened directory (no snapshot-per-exec).

## Problem / Current State

- The Node demo uses `MemoryWorkspace` as the shadow workspace.
- `WasmtimeWasiRunner` currently:
  - writes a full FS snapshot to a temp directory per execution,
  - spawns `wasmtime` per execution,
  - reads back a full FS snapshot after execution.

This works for tests, but is too slow for real workloads and does not match the “shadow workspace mounted as WASI FS” vision.

## Deliverables

- A Node shadow workspace mode backed by a **dedicated shadow directory** (e.g. `.openagentic/shadow/<sessionId>`).
- `WasmtimeWasiRunner` mounts that shadow directory as the only writable preopen.
- `Command(argv)` executes against the mounted shadow directory without expensive per-call snapshotting.

## Design

### Shadow directory semantics

- Real project dir: `<project>`
- Shadow dir: `<project>/.openagentic/shadow/<sessionId>` (or a stable single shadow root per project)
- Import copies real → shadow.
- Tools only see shadow.
- `/commit` computes diff (shadow vs base snapshot) and applies to real.

### Runner semantics

- `WasmtimeWasiRunner.execModule()` accepts an optional `preopenDir` mode:
  - if `preopenDir` is provided, do not write/read snapshots; just mount it
  - otherwise, preserve the existing snapshot-based behavior (useful for `MemoryWorkspace`)

## Tasks

### Task 1: Add a `ShadowDirWorkspace` helper for Node demos

**Files (suggested):**
- Create: `packages/demo-node/src/shadow-dir.ts`
- Modify: `packages/demo-node/src/index.ts` (enable `--shadow-dir` or auto mode for `--wasi`)

Acceptance:
- `pnpm -C packages/demo-node start -- --project . --wasi` uses a local shadow directory.

### Task 2: Extend `WasmtimeWasiRunner` to mount the shadow dir

**Files (suggested):**
- Modify: `packages/wasi-runner-wasmtime/src/index.ts`
- Test: `packages/wasi-runner-wasmtime/src/__tests__/mount-dir.test.ts`

Acceptance:
- Running a wasm module that writes `out.txt` results in `out.txt` existing under the shadow dir without snapshot round-trips.

### Task 3: Teach `CommandTool` to use the dir-mounted path when available

**Files (suggested):**
- Modify: `packages/tools/src/command.ts`
- Test: `packages/tools/src/__tests__/command-mount-dir.test.ts`

Acceptance:
- When the workspace is `LocalDirWorkspace` (shadow-dir mode), `CommandTool` uses the mount-dir runner path.
- When the workspace is `MemoryWorkspace`, it falls back to snapshots.

**Commit:** `feat(wasi): mount shadow dir for wasmtime`

