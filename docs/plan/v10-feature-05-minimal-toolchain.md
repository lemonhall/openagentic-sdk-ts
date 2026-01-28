# v10 Feature 05: Minimal “coreutils-like” Toolchain (WASI applets + aliases) (Implementation Plan)

> **Goal:** Ship a practical command set that matches what shell scripts expect, without trying to become BusyBox.

## Strategy (recommended)

- Provide missing commands as **WASI applets** in the official bundle (portable across browser/server).
- Keep the JS host builtins for shell-control semantics (`command`, `export`, etc.).
- Allow a few compatibility aliases (e.g. `rg` → `grep`-style search) when full parity is not feasible.

## Scope (v10 minimum)

- Identity/system:
  - `uname` (minimal flags: `-s`, default)
  - `whoami` (best-effort; configurable fallback)
  - `date` (ISO-8601 default; stable test mode via env override)
- Text/search:
  - `grep` improvements (at least `-n`)
  - `rg`-compatible wrapper (minimal flags: `-n`, path recursion)
- File/dir:
  - ensure `ls`, `cat`, `mkdir`, `rm`, `cp`, `mv` are present and behave consistently

## Acceptance

- A demo script using `command -v`, `date`, `uname`, `rg` runs in both browser and node demo paths.
- Tests exist for each new applet and for `rg` wrapper behavior.

## Files (expected)

- Add/Modify: `packages/bundles/sample/wat/*.wat` (then regenerate bundle artifacts)
- Modify: `packages/bundles/scripts/generate-sample-core-utils.mjs`
- Update: `packages/bundles/sample/bundles/core-utils/*` + `packages/bundles/official/bundles/core-utils/*` + `packages/demo-web/public/bundles/core-utils/*`
- Add tests: `packages/bundles/src/__tests__/*`

## Steps (TDD; one command per commit)

Each command lands as:

1. Add a failing bundles test (red)
2. Implement the WAT module / wrapper (green)
3. Regenerate bundles
4. Commit + push

