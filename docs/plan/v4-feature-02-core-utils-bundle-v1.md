# v4 Feature 02: `core-utils` Bundle v1 (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Ship an official WASI tool bundle that is usable enough to power the default `Bash` experience.

## Problem / Current State

- The repo currently ships a minimal sample `core-utils` bundle (echo/cat/grep).
- This is insufficient for real agent workflows and blocks “WASI-first by default”.

## Deliverables

- Expand the `core-utils` bundle to include:
  - `ls`, `pwd`
  - `mkdir`, `rm`, `cp`, `mv`
  - `head`, `tail`, `wc`
  - keep `cat`, `grep`, `echo`
- Update tests to cover at least:
  - `ls` output determinism in a known workspace
  - pipeline composition: `ls | grep ...`

## Build strategy (recommended for v4)

- Stick to the current “deterministic wasm in repo” approach for v4 to ship quickly.
- Add source/build tooling later (tracked), but v4 focuses on semantics + runner wiring.

## Tasks

### Task 1: Add wasm modules + manifest updates

**Files:**
- Modify: `packages/bundles/sample/bundles/core-utils/0.0.0/manifest.json`
- Add: `packages/bundles/sample/bundles/core-utils/0.0.0/<cmd>.wasm`
- Modify: `packages/bundles/scripts/generate-sample-core-utils.mjs`
- Test: `packages/bundles/src/__tests__/sample-core-utils.test.ts`

### Task 2: Add integration tests using `CommandTool`

**Files:**
- Test: `packages/tools/src/__tests__/command-core-utils.test.ts`

Acceptance:
- `Command(argv=["ls"])` works against a workspace containing known files.

**Commit:** `feat(bundles): expand core-utils baseline`

