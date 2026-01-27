# v4 Feature 04: Browser WASI Runner in Worker with OPFS-backed Sync FS (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Execute WASI modules in the browser with the same filesystem semantics as server: only the shadow workspace root is writable, and performance is acceptable for real projects.

## Notes

This supersedes v3’s `docs/plan/v3-feature-03-browser-worker-opfs-wasi-runner.md` as the execution plan.

## Tasks

### Task 1: Worker protocol + runner facade

**Files:**
- Create: `packages/wasi-runner-web/src/worker/runner.ts`
- Create: `packages/wasi-runner-web/src/worker/worker.ts`
- Modify: `packages/wasi-runner-web/src/index.ts` (export `WorkerWasiRunner`)
- Test: `packages/wasi-runner-web/src/__tests__/worker-runner.test.ts`

### Task 2: OPFS sync FS implementation (preview1 subset)

**Files:**
- Create: `packages/wasi-runner-web/src/worker/opfs-sync-fs.ts`
- Modify: `packages/wasi-runner-web/src/worker/worker.ts`
- Test: `packages/wasi-runner-web/src/__tests__/opfs-sync-fs.test.ts`

**Implementation note (v4 actual):**
- WASI preview1 filesystem hostcalls are synchronous, while OPFS directory/file APIs are promise-based. Instead of trying to do “true sync OPFS syscalls”, the worker keeps an **in-memory FS snapshot** that implements sync preview1 semantics, and **persists deltas** to the OPFS shadow workspace after each command. From the user/tooling perspective, the workspace is OPFS-mounted and there is no per-command main-thread snapshot round-trip.

### Task 3: Wire demo-web to use Worker runner

**Files:**
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `packages/demo-web/src/main.ts`

**Commit:** `feat(wasi-runner-web): worker + OPFS sync FS`
