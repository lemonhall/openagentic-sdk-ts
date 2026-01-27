# v7 Feature 02: macOS Backend — sandbox-exec (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Provide a best-effort macOS sandbox backend using `sandbox-exec`, with clear version caveats.

## Notes

`sandbox-exec` support varies across macOS versions and Apple’s sandboxing direction. This backend must be treated as best-effort:

- If not available: skip/disable with a clear message.
- Keep the contract stable even if the backend is limited.

## Tasks

### Task 1: Profile generator + unit tests

**Files:**
- Create: `packages/node/src/sandbox/macos-sandbox-exec.ts`
- Test: `packages/node/src/__tests__/macos-sandbox-profile.test.ts`

Acceptance:

- Generates a profile that:
  - allows read-only system access needed to run shell commands
  - allows read/write only under the shadow dir (mapped to a fixed path)
  - optionally denies network

### Task 2: Integration test (skip-gated)

**Files:**
- Test: `packages/node/src/__tests__/macos-sandbox.integration.test.ts`

Runs only when:

- `process.platform === "darwin"`
- `sandbox-exec` exists

Acceptance:

- A tiny command can write to shadow dir
- It cannot read a disallowed path

### Task 3: Wire into backend registry

**Files:**
- Modify: `packages/node/src/sandbox/registry.ts`

### Task 4: Docs

**Files:**
- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/sandboxing.zh-CN.md`

Include:

- how to check if `sandbox-exec` exists
- limitations and fallback guidance

**Commit:** `feat(node): add macos sandbox-exec backend`

