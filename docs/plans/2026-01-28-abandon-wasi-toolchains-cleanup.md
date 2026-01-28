# Abandon WASI Toolchains Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Fully remove WASI/bundles/registry “distro” direction from code + docs; keep Node/server host-native sandbox runners and browser TS-native tools only.

**Architecture:** Node/server executes host binaries via `NativeRunner` backends (bwrap/nsjail/sandbox-exec/jobobject) against the shadow workspace; browser stays TS-only (OPFS) with no WASI execution path.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Node child_process, Bubblewrap/nsjail/sandbox-exec (optional).

---

### Task 1: Make sandbox registry native-only

**Files:**
- Modify: `packages/node/src/sandbox/registry.ts`
- Modify: `packages/node/src/__tests__/sandbox-registry.test.ts`
- Modify: `packages/node/src/__tests__/linux-sandbox-argv.test.ts`
- Modify: `packages/node/src/__tests__/linux-sandbox.integration.test.ts`
- Modify: `packages/node/package.json`

**Step 1: Remove ProcessSandbox surface**
- Delete `createProcessSandbox` from `SandboxBackend` type.
- Remove all imports from `@openagentic/wasi-runner-wasmtime`.

**Step 2: Update tests**
- Rewrite registry tests to validate `createNativeRunner(...)` only.
- Drop any “wrap wasmtime” assertions.

**Step 3: Run package tests**
- Run: `pnpm -C packages/node test`
- Expected: PASS (integration tests remain gated by env).

---

### Task 2: Remove bundles + WASI runner packages from the workspace

**Files:**
- Delete: `packages/bundles/**`
- Delete: `packages/wasi-runner/**`
- Delete: `packages/wasi-runner-web/**`
- Delete: `packages/wasi-runner-wasmtime/**`
- Modify: `pnpm-workspace.yaml` (only if exclusions needed)
- Modify: `pnpm-lock.yaml` (best-effort, if available locally)

**Step 1: Delete packages**
- Remove the directories (repo no longer builds/tests them).

**Step 2: Remove all workspace dependencies**
- Update package deps that referenced these packages:
  - `packages/tools/package.json`
  - `packages/demo-web/package.json`
  - `packages/demo-node/package.json`
  - `packages/node/package.json`

**Step 3: Remove leftover bundle artifacts**
- Delete root artifacts like `rg.wasm` if not used anymore.

---

### Task 3: Remove WASI/bundles usage from demos + tools tests

**Files:**
- Delete: `packages/demo-web/src/bundle-cache.ts`
- Delete: `packages/demo-web/src/url-defaults.ts`
- Delete: `packages/demo-web/src/__tests__/bundle-cache.test.ts`
- Delete: `packages/demo-web/src/__tests__/bundles-default.test.ts`
- Delete: `packages/demo-web/src/__tests__/wasi-*.test.ts`
- Modify: `packages/demo-node/src/__tests__/runtime-wire.test.ts`
- Modify: `packages/demo-node/src/__tests__/cli-bash.e2e.test.ts` (rename/retitle)
- Modify: `packages/tools/src/__tests__/bash-tool.test.ts`

**Step 1: Browser demo**
- Ensure `demo-web` has no WASI toggles, workers, bundle cache, or “bundle base url” logic.

**Step 2: Node demo**
- Ensure CLI and runtime wiring tests only cover TS tools + host-native `Bash`.

**Step 3: Tools tests**
- Remove the WASI backend `BashTool` tests and keep TS-native shell tests.

---

### Task 4: Mark abandoned features in docs (v13 pivot)

**Files (likely):**
- Modify: `docs/plan/index.md`
- Modify: `docs/plan/v1-feature-05-tool-bundles-registry.md`
- Modify: `docs/plan/v3-index.md`
- Modify: `docs/plan/v4-index.md`
- Modify: `docs/plan/v9-index.md`
- Modify: `docs/plan/v10-index.md`
- Modify: `docs/plan/v11-index.md`
- Modify: `docs/plan/v12-index.md` and key v12 feature docs mentioning WASI bundles
- Modify: `docs/guide/tools/README.md`

**Step 1: Fix inconsistent “BusyBox-like WASI” language**
- v13 pivot is **host-native** on Node/server, not “multicall WASI”.

**Step 2: Add explicit status banners where missing**
- For any v1–v12 plan doc describing “bundles/registry/WASI distro”, add:
  - `> **Status:** ABANDONED as of v13 (2026-01-28).`

---

### Task 5: Repo-wide verification

**Step 1: Build + test**
- Run: `pnpm test`
- Expected: PASS

**Step 2: Sanity grep**
- Run: `rg -n \"wasi-runner|wasmtime|bundles\" -S packages docs`
- Expected: Only historical “ABANDONED” mentions in docs (no live code imports).
