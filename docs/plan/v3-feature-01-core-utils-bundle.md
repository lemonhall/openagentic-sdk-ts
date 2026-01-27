# v3 Feature 01: Official `core-utils` Tool Bundle (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Ship an official WASI tool bundle that is useful enough to power the default `Bash` experience.

## Problem / Current State

- `@openagentic/bundles` supports manifests + download + sha256 verification.
- The repo ships only a tiny sample bundle (e.g. `echo.wasm`), which is not enough for real agent work.

Without a real bundle set, a WASI-first `Bash` is unusable.

## Bundle scope (v3 minimal)

Target a pragmatic baseline that supports typical agent loops:

- `cat`, `ls`, `pwd`
- `mkdir`, `rm`, `cp`, `mv`
- `grep`
- `head`, `tail`, `wc` (optional, but high leverage)

Notes:
- Prefer a **multi-call** binary (“busybox style”) only if it’s significantly easier to build/ship; otherwise ship one wasm per command.
- Commands must operate only within the preopened shadow workspace root.

## Deliverables

- A bundle directory layout matching the installer expectations:
  - `bundles/core-utils/<version>/manifest.json`
  - `bundles/core-utils/<version>/*.wasm`
- A reproducible build script that produces the wasm artifacts.
- Tests proving:
  - the manifest parses,
  - sha256 values match,
  - `Command(argv)` can execute at least `ls` and `cat` via the bundle in both runners.

## Tasks

### Task 1: Choose a build strategy and lock it down

Pick one:

- **Rust (recommended)**: `cargo build --target wasm32-wasi` per utility crate.
- **C (wasi-sdk)**: small C utilities compiled via wasi-sdk toolchain.

Acceptance:
- One command can be rebuilt from source on CI/dev without manual steps.

### Task 2: Add `core-utils` bundle source + build pipeline

**Files (suggested):**
- Create: `packages/bundles-core-utils/` (source + build scripts)
- Create: `packages/bundles/sample/bundles/core-utils/<version>/...` (artifacts for tests/dev)
- Modify: `packages/bundles/sample/README.md` (document the new bundle)

Acceptance:
- `pnpm -C packages/bundles-core-utils build` produces wasm files + a manifest.

### Task 3: Add runner/tool integration tests

**Files (suggested):**
- Test: `packages/tools/src/__tests__/command-core-utils.test.ts`
- Test: `packages/wasi-runner-web/src/__tests__/core-utils.test.ts`
- Test: `packages/wasi-runner-wasmtime/src/__tests__/core-utils.test.ts` (skip if `wasmtime` missing)

Acceptance:
- In web runner, `Command(argv=["ls"])` returns deterministic stdout.
- In wasmtime runner, the same command returns the same stdout.

**Commit:** `feat(bundles): add core-utils bundle`

