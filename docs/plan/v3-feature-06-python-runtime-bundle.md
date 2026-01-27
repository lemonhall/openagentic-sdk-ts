# v3 Feature 06 (Optional): `python` Runtime Bundle + `Python` Tool (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Let agents run Python code inside the same sandbox model as other tools: **shadow workspace only**, portable across **browser + server**, and **WASI-first** when feasible.

## Why this exists

During the original design discussion, “Python support (default install)” was explicitly desired. The TS repo is runnable (v2) and is converging on WASI-first tooling (v3), but it does not yet provide a Python runtime/tool.

This feature is **optional** for v3 because it is large, but it should be tracked as a first-class plan so we don’t “forget the tail”.

## Constraints / policy

- **No host Python.** The tool must not escape the sandbox by spawning the system interpreter.
- **Shadow workspace only.** Python code can read/write only inside the shadow workspace root.
- **Official source only.** Runtime downloads are allowed, but only from the official registry (signatures required once v3-feature-05 lands).
- **No cookie leakage.** Any network capability (if enabled) must use injected `fetch` with `credentials: "omit"`.
- **Resource limits are mandatory.** CPU timeouts, max stdout/stderr, and (where possible) memory ceilings.

## Recommended approach (phased)

### Phase A (recommended first): MicroPython-in-WASI bundle

Rationale: small footprint, easier to ship, fewer filesystem/syscall requirements than CPython, and good enough for “glue code” tasks (JSON/text processing).

- Bundle: `lang-python/<version>/micropython.wasm` exposed as command `python`
- Tool: `Python` is a thin wrapper over `Command(argv)`:
  - `argv` default: `["python", "-c", code]` or `["python", scriptPath, ...args]`
  - `cwd` constrained to the shadow workspace

Limitations (documented):
- Not CPython-compatible; stdlib coverage is limited; no `pip`.

### Phase B (later): CPython-in-WASI bundle (fuller compatibility)

Rationale: closer to the Python SDK baseline and user expectations, but requires:
- a workable stdlib packaging story,
- stronger WASI FS + clocks + randomness coverage,
- likely multiple preopens (shadow root + read-only stdlib + optional site-packages).

## Tool API shape (TS)

Create a new tool that is argv-first:

- Name: `Python`
- Input (suggested):
  - `argv?: string[]` (advanced; defaults derived below)
  - `code?: string` (runs `-c`)
  - `file_path?: string` (runs a script inside the shadow workspace)
  - `stdin?: string`
  - `cwd?: string`
  - `env?: Record<string,string>`
- Output:
  - `exitCode: number`
  - `stdout: string`
  - `stderr: string`

Validation rules:
- Exactly one of `code` or `file_path` must be set unless `argv` is provided.
- All paths must resolve inside the shadow workspace root.

## Acceptance criteria

- Node demo: with WASI mode enabled, `Python` can run:
  - `print("hi")` and returns `hi\n`
  - read/write a file in the shadow workspace and the file appears in `/status`
- Browser demo: same behavior (via worker OPFS runner once v3-feature-03 lands).
- The Python runtime is fetched/installed only from the official registry and cached (OPFS in browser, local dir in Node).
- Network access is disabled by default; if enabled, it uses injected `fetch` and is audited.

## Tasks

### Task 1: Bundle plumbing for a `lang-python` bundle

**Files (suggested):**
- Create: `packages/bundles/sample/bundles/lang-python/<version>/manifest.json`
- Add: `packages/bundles/sample/bundles/lang-python/<version>/python.wasm` (or `micropython.wasm`)
- Test: `packages/bundles/src/__tests__/sample-lang-python.test.ts`

Acceptance:
- Manifest sha256 verification passes in tests.

### Task 2: Add `PythonTool` as a wrapper around `CommandTool`

**Files (suggested):**
- Create: `packages/tools/src/python/python.ts`
- Modify: `packages/tools/src/index.ts` (export)
- Test: `packages/tools/src/__tests__/python-tool.test.ts`

Acceptance:
- `Python` executes `-c` and returns stdout/stderr/exitCode.

### Task 3: Wire demos (Node + Web) behind a toggle/flag

**Files (suggested):**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Docs: `docs/guide/tools/python.md`

Acceptance:
- Demos expose `Python` tool when enabled and show results in the event log.

### Task 4: Decide and document “CPython later” requirements

**Files (suggested):**
- Modify: `docs/plan/2026-01-27-vision-and-core-design.md` (link this plan + state Phase A/B)

Acceptance:
- The repo clearly documents what “Python support” means in v3 vs later.

**Commit:** `feat(tools): add Python tool (WASI runtime bundle)`

