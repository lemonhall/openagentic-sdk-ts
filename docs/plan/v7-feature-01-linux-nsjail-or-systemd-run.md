# v7 Feature 01: Linux Backend #2 (nsjail or systemd-run) (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Add a second Linux sandbox backend in addition to Bubblewrap.

## Option A: nsjail (recommended if available)

- Strong, purpose-built sandbox runner.
- Clear flags for mounts, uid/gid mapping, time/mem limits, and optional network namespace.

## Option B: systemd-run (fallback)

- Uses systemd’s sandboxing directives (good on servers that already use systemd).
- Depends on systemd availability and permissions.

## Tasks (pick one option, implement fully)

### Task 1: Argv builder + unit tests

**Files:**
- Create: `packages/node/src/sandbox/linux-nsjail.ts` OR `packages/node/src/sandbox/linux-systemd-run.ts`
- Test: `packages/node/src/__tests__/linux-sandbox-argv.test.ts`

Test should validate:

- binds shadow dir as `/workspace`
- sets working directory
- network deny option
- deterministic ordering

### Task 2: Integration test (skip-gated)

**Files:**
- Test: `packages/node/src/__tests__/linux-sandbox.integration.test.ts`

Runs only when:

- `process.platform === "linux"`
- dependency exists in PATH (`nsjail` or `systemd-run`)

Acceptance: a tiny command writes a file in the shadow dir and cannot see host paths unless explicitly bound.

### Task 3: Wire into backend registry

**Files:**
- Modify: `packages/node/src/sandbox/registry.ts`

### Task 4: Docs

**Files:**
- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/sandboxing.zh-CN.md`

Include:

- installation on Ubuntu 24.04
- a one-line smoke command
- when to prefer it over Bubblewrap

**Commit:** `feat(node): add linux sandbox backend`

