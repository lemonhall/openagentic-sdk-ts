# v7 Feature 03: Windows Backend — Job Objects (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Add a pragmatic Windows sandbox backend using Job Objects as a baseline for resource limiting and process containment.

## Notes

Windows sandboxing primitives are different from Linux/macOS. Job Objects are a pragmatic baseline:

- Can enforce time/memory limits and kill process trees.
- Does not provide the same mount-namespace style filesystem isolation as Bubblewrap.

For filesystem isolation on Windows, an AppContainer-based approach may be required later; for v7, document limitations explicitly.

## Tasks

### Task 1: Implement Job Object wrapper for spawned processes

**Files:**
- Create: `packages/node/src/sandbox/windows-jobobject.ts`
- Test: `packages/node/src/__tests__/windows-jobobject.test.ts`

Acceptance:

- Spawns a command and ensures the process tree is terminated on timeout.
- Emits audit records compatible with the sandbox audit schema.

### Task 2: Integration test (skip-gated)

**Files:**
- Test: `packages/node/src/__tests__/windows-jobobject.integration.test.ts`

Runs only when:

- `process.platform === "win32"`

Acceptance:

- A long-running command is killed by timeout.

### Task 3: Wire into backend registry

**Files:**
- Modify: `packages/node/src/sandbox/registry.ts`

### Task 4: Docs

**Files:**
- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/sandboxing.zh-CN.md`

Include:

- limitations (no FS namespace isolation)
- recommended alternatives (AppContainer / Windows Sandbox) as future work

**Commit:** `feat(node): add windows jobobject backend`

