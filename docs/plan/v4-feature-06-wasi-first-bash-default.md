# v4 Feature 06: WASI-first `Bash` as the Default (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Make WASI-backed `Bash` the default tool engine (when available), preserving the v2 TS-native fallback.

## Deliverables

- Capability detection:
  - runner configured
  - `core-utils` v1 installed (required commands present)
- Default behavior in demos:
  - Node: WASI-first when `wasmtime` is present
  - Browser: WASI-first when worker runner is available
- Clear user-facing docs about what “Bash” is (restricted + sandboxed) and how to debug missing bundles.

## Tasks

### Task 1: Capability detection helper

**Files:**
- Create: `packages/tools/src/bash/wasi-availability.ts`
- Test: `packages/tools/src/__tests__/bash-wasi-availability.test.ts`

### Task 2: Route `Bash` through `ShellTool` when available

**Files:**
- Modify: `packages/tools/src/bash/bash.ts`
- Test: `packages/tools/src/__tests__/bash-wasi-default.test.ts`

### Task 3: Demo wiring + docs

**Files:**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `docs/guide/tools/bash.md`

**Commit:** `feat(tools): make Bash WASI-first by default`

