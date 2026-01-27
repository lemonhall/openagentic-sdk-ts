# v3 Feature 04: WASI-first `Bash` (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Make the default `Bash` tool execute pipelines/redirects via WASI modules (`Shell(script)` → `Command(argv)`), with a safe fallback to TS builtins.

## Problem / Current State

- v2 ships a restricted, workspace-native `Bash` with builtins implemented in TypeScript.
- The repo already has:
  - `CommandTool` (WASI argv execution over bundles)
  - `ShellTool` (parses/executes a restricted shell subset by calling `CommandTool`)
- The runnable demos do not enable a usable WASI tool bundle set by default.

## Deliverables

- A `Bash` tool that can route to one of two backends:
  - **WASI backend**: `ShellTool` + `CommandTool` + installed bundles (`core-utils` required)
  - **TS backend**: the existing workspace-native builtins (v2 behavior)
- A deterministic selection policy:
  - default to WASI when available and explicitly enabled (demo flag/toggle),
  - otherwise fall back to TS backend.
- Docs explaining the difference and how to enable WASI mode in Node/browser.

## Tasks

### Task 1: Define a shared “WASI availability” capability

**Files (suggested):**
- Create: `packages/tools/src/bash/wasi-availability.ts`
- Test: `packages/tools/src/__tests__/bash-backend-selection.test.ts`

Acceptance:
- A function can decide if `core-utils` bundle commands are installed and a runner is configured.

### Task 2: Implement WASI-backed `Bash` backend

**Files (suggested):**
- Create: `packages/tools/src/bash/bash-wasi.ts`
- Modify: `packages/tools/src/bash/bash.ts` (route based on availability)
- Test: `packages/tools/src/__tests__/bash-wasi.test.ts`

Acceptance:
- `Bash: { command: "ls | grep foo" }` works using WASI `ls` + `grep` commands.

### Task 3: Wire demos and update guides

**Files (suggested):**
- Modify: `packages/demo-node/src/runtime.ts` (enable WASI mode when `--wasi`)
- Modify: `packages/demo-web/src/agent.ts` (enable WASI mode when toggled)
- Modify: `docs/guide/tools/bash.md` (document both backends)

**Commit:** `feat(tools): add WASI-first Bash backend`

