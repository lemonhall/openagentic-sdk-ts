# v4 Feature 03: Node WASI via `wasmtime` + Mounted Shadow Directory (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Make server-side WASI execution mount the shadow workspace as a preopened directory (no snapshot-per-exec).

## Notes

This supersedes v3’s `docs/plan/v3-feature-02-node-wasmtime-shadow-dir.md` as the execution plan.

## Tasks

### Task 1: Node “shadow dir” workspace helper

**Files:**
- Create: `packages/demo-node/src/shadow-dir.ts`
- Modify: `packages/demo-node/src/index.ts` (auto-enable shadow-dir when WASI mode on)

Acceptance:
- `pnpm -C packages/demo-node start -- --project .` uses a persistent shadow directory per session.

### Task 2: `WasmtimeWasiRunner` mount mode

**Files:**
- Modify: `packages/wasi-runner-wasmtime/src/index.ts`
- Test: `packages/wasi-runner-wasmtime/src/__tests__/mount-dir.test.ts`

Acceptance:
- WASI module writes persist directly under the mounted shadow dir.

### Task 3: Teach `CommandTool` to use mount mode when available

**Files:**
- Modify: `packages/tools/src/command.ts`
- Test: `packages/tools/src/__tests__/command-mount-dir.test.ts`

**Commit:** `feat(wasi): mount shadow dir for wasmtime`

