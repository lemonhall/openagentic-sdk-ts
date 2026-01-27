# v3 Feature 03: Browser WASI Runner in WebWorker with OPFS-backed Sync FS (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Execute WASI modules in the browser with **the same filesystem semantics** as server: only the shadow workspace root is writable, and performance is acceptable for real projects.

## Problem / Current State

- Browser shadow workspace is OPFS-backed and works well for TS-native tools.
- The current web WASI runner is “in-process” and uses an in-memory snapshot FS.
- WebAssembly WASI preview1 hostcalls are synchronous; OPFS workspace APIs are generally async.

This means we can’t simply “wire Workspace into WASI” on the main thread.

## Key idea

Use a **WebWorker** and OPFS **synchronous access handles** (`createSyncAccessHandle`) to implement the WASI preview1 filesystem syscalls synchronously inside the worker.

## Deliverables

- A new browser WASI runner that:
  - runs inside a Worker,
  - mounts OPFS as the preopened root,
  - supports the subset needed by `core-utils` (path_open, fd_read, fd_write, fd_close, fd_seek, fd_filestat_get, path_filestat_get, etc.)
- A demo-web toggle to enable WASI-backed `Bash` mode (v3-feature-04).

## Constraints

- Keep the default browser demo security model:
  - no cookies (`credentials: "omit"`),
  - no API keys in the browser (use proxy).
- Do not require cross-origin isolation unless absolutely necessary.

## Tasks

### Task 1: Create a worker protocol + runner facade

**Files (suggested):**
- Create: `packages/wasi-runner-web/src/worker/runner.ts` (main-thread facade)
- Create: `packages/wasi-runner-web/src/worker/worker.ts` (worker entry)
- Modify: `packages/wasi-runner-web/src/index.ts` (export `WorkerWasiRunner`)
- Test: `packages/wasi-runner-web/src/__tests__/worker-runner.test.ts`

Acceptance:
- The runner can execute a trivial wasm module that writes to stdout in the worker.

### Task 2: Implement OPFS-backed sync FS for WASI preview1

**Files (suggested):**
- Create: `packages/wasi-runner-web/src/worker/opfs-sync-fs.ts`
- Modify: `packages/wasi-runner-web/src/worker/worker.ts`
- Test: `packages/wasi-runner-web/src/__tests__/opfs-sync-fs.test.ts`

Acceptance:
- A wasm module can create/write/read a file under `/` (preopened root) and the contents are visible to the OPFS workspace.

### Task 3: Wire demo-web OPFS workspace to the worker runner

**Files (suggested):**
- Modify: `packages/demo-web/src/agent.ts` (create runner in WASI mode)
- Modify: `packages/demo-web/src/main.ts` (toggle + state)

Acceptance:
- When WASI mode is enabled, `Bash` uses WASI modules; otherwise it uses TS-native tools.

**Commit:** `feat(wasi-runner-web): worker + OPFS sync FS`

