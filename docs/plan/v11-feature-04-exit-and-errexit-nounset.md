# v11 Feature 04: Execution Controls (`exit`, minimal `set -e` / `set -u`) (Implementation Plan)

> **Goal:** Add the minimal control plumbing to make scripts fail fast and to stop execution cleanly.

## Scope

- `exit [code]`:
  - terminates the current script (or subshell) with given status (default: last exit code).
- `set -e` (errexit) minimal:
  - when enabled, a non-zero status in a simple command causes the current script to stop (document exceptions we don’t implement yet).
- `set -u` (nounset) minimal:
  - expanding an unset variable is an error (document exceptions; start strict for `$var` only).

## Acceptance

- Fixtures cover:
  - `false; echo after` stops with `set -e`
  - `echo $NOPE` errors with `set -u`
  - `exit 7; echo after` exits with 7 and prints nothing after

## Files (expected)

- Modify: `packages/tools/src/shell/exec.ts`
- Modify: `packages/tools/src/bash/builtins.ts`
- Add tests: `packages/tools/src/shell/__tests__/controls.test.ts`
- Add compat fixture(s): `packages/tools/src/__tests__/shell-compat/`

## Steps (TDD; per-control commit)

1. Add failing fixture for `exit`.
2. Implement `exit` as a control-flow exception caught at the right boundary.
3. Repeat for `set -e` and `set -u`.
4. Commit + push after each.

