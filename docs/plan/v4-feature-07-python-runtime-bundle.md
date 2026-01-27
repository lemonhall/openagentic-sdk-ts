# v4 Feature 07: `python` Runtime Bundle + `Python` Tool (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Provide a `Python` tool that runs in the same sandbox model as other tools (shadow workspace only), portable across browser + server.

## Notes

This plan is based on `docs/plan/v3-feature-06-python-runtime-bundle.md`, upgraded to a v4 execution item.

## Approach (v4)

- Phase A: MicroPython-in-WASI runtime bundle (official, signed).
- Phase B (tracked): CPython-in-WASI + richer stdlib packaging.

> **Note (repo constraint):** In offline/sandboxed environments, shipping a full MicroPython/CPython WASI runtime artifact may be infeasible. v4 can still land the end-to-end plumbing (bundle install + tool wrapper + demo wiring) using a minimal placeholder WASI module, and swap in a real runtime bundle once an official artifact source is available.

## Tasks

### Task 1: Add `lang-python` sample bundle + tests

**Files:**
- Create: `packages/bundles/sample/bundles/lang-python/0.0.0/manifest.json`
- Add: `packages/bundles/sample/bundles/lang-python/0.0.0/python.wasm`
- Test: `packages/bundles/src/__tests__/sample-lang-python.test.ts`

### Task 2: Implement `Python` tool wrapper over `CommandTool`

**Files:**
- Create: `packages/tools/src/python/python.ts`
- Modify: `packages/tools/src/index.ts`
- Test: `packages/tools/src/__tests__/python-tool.test.ts`

### Task 3: Enable by default (installed runtime) + docs

**Files:**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Docs: `docs/guide/tools/python.md`

**Commit:** `feat(tools): add Python tool (WASI runtime bundle)`
