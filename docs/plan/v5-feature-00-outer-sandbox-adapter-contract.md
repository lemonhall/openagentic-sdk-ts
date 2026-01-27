# v5 Feature 00: Outer Sandbox Adapter Contract (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Define a stable server-side interface that can wrap WASI runner process execution with an “outer” sandbox (Bubblewrap, nsjail, gVisor, etc.).

## Design notes (recommended)

WASI remains the portability boundary and the source of tool semantics. The outer sandbox is purely a hardening layer around the process that hosts the WASI runtime (e.g., `wasmtime` CLI today).

Recommended minimal abstraction: a **spawn wrapper** that takes an intended command invocation and returns a rewritten invocation.

This keeps the contract small, makes it easy to support many sandbox technologies, and avoids leaking sandbox-specific concepts into tool code.

## Tasks

### Task 1: Add a generic “spawn wrapper” type

**Files:**
- Modify: `packages/wasi-runner-wasmtime/src/index.ts`
- Create: `packages/wasi-runner-wasmtime/src/process-sandbox.ts`
- Test: `packages/wasi-runner-wasmtime/src/__tests__/process-sandbox.test.ts`

**Spec (proposed):**
- Add `ProcessSandbox` interface:
  - `wrap(command: { cmd: string; args: string[]; env: Record<string,string>; cwd?: string; mounts?: {...}[] }): { cmd: string; args: string[]; env: Record<string,string>; cwd?: string }`
  - Must be pure and deterministic (no I/O); I/O discovery (e.g. finding `bwrap`) stays in the runner.
- Add an optional `processSandbox?: ProcessSandbox` to `WasmtimeWasiRunner` constructor options.
- Runner applies `wrap(...)` just before `spawn(...)`.

**Acceptance:**
- Existing tests and demos behave identically when `processSandbox` is undefined.
- Unit test proves that wrapper output is used (no integration sandbox required).

### Task 2: Add minimal audit surface

**Files:**
- Modify: `packages/wasi-runner/src/types.ts`
- Modify: `packages/wasi-runner-wasmtime/src/index.ts`
- Test: `packages/wasi-runner-wasmtime/src/__tests__/process-sandbox-audit.test.ts`

**Spec (proposed):**
- Extend `WasiExecResult` with an optional `sandboxAudits?: SandboxAuditRecord[]`.
- Record at least:
  - `kind` (e.g. `"process-sandbox"`)
  - `wrapperName`
  - `wrappedCmd` + `wrappedArgs` (truncate to safe size)
  - `mounts` (shadow dir only; avoid leaking host paths when possible)

**Acceptance:**
- When a wrapper is installed, audits are present and structured-cloneable.

**Commit:** `feat(wasi-runner-wasmtime): add process sandbox adapter`

