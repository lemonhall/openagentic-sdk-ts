# v9 Feature 02: Real `Python` Runtime Bundle (MicroPython-first) (Implementation Plan)

> **Goal:** Replace the current demo-stub `lang-python@0.0.0` with a real WASI Python runtime that can run useful “agent scripting” workloads under strict limits in both browser and server WASI runners.

## Design options (pick one; v9 recommends Option A)

### Option A (recommended): MicroPython as the first “real” runtime

- Ship `lang-python@0.1.x` backed by a MicroPython `wasm32-wasi` build.
- Keep the tool API stable (`Python` tool calls `python -c ...`).
- Define a strict “supported subset” contract and enforce it with tests + limits.

**Pros:** Smaller, shippable, good enough for many agent tasks.  
**Cons:** Not full CPython; packaging story (pip) still deferred.

### Option B: CPython WASI (future)

**Pros:** Real stdlib + semantics.  
**Cons:** Larger, harder to ship/build; heavier CI story.

### Option C: Keep stub but enforce disable-by-default + docs (fallback only)

**Pros:** Low effort.  
**Cons:** Doesn’t converge the “Python story”.

## Scope

- Introduce an “official” `lang-python@0.1.x` bundle.
- Provide a reproducible build script for MicroPython WASI.
- Add an integration test that runs `PythonTool` end-to-end using a WASI runner that supports the needed hostcalls.
- Update docs to reflect “real runtime shipped” (or, if blocked, explicitly state why and enforce disable-by-default).

## Acceptance

- `Python` tool can run at least:
  - arithmetic + printing
  - JSON parse/format (`import json`) if supported by the chosen runtime build
- A deterministic integration test exists and runs in CI (or is skip-gated with a clear prerequisite).
- The demo no longer claims Python is “real” if it is not; docs are explicit and tested.

## Files (expected)

- Modify/Create: `packages/bundles/official/bundles/lang-python/0.1.0/*`
- Create: `packages/bundles/scripts/build-micropython-wasi.sh`
- Create: `packages/tools/src/__tests__/python-wasi.integration.test.ts`
- Modify: `docs/guide/tools/python.md`

## Steps (TDD)

1. Write the integration test for `PythonTool` using a filesystem-backed bundle registry.
2. Run to red (no real runtime bundle yet).
3. Add build script + generated bundle artifacts (or a CI fetch step if artifacts can’t live in-repo).
4. Run to green.
5. Tighten limits + error messages, add one more “non-trivial” Python smoke case.

