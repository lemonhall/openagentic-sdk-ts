# v10 Feature 04: Builtins Suite (POSIX-ish baseline) (Implementation Plan)

> **Goal:** Provide a baseline builtin set so scripts don’t depend on external commands for core control flow and environment management.

## Scope (minimum builtins)

- `:` / `true` / `false`
- `echo` / `printf` (start with `%s`)
- `cd` / `pwd`
- variable assignment (`FOO=bar`) and `export` / `unset`
- `set` (start with `-e` / `-u` and positional params via `set -- ...`)
- `shift` / `exit`
- `command -v` (must not be “unknown command”; used heavily in scripts)

## Acceptance

- Unit tests cover:
  - `command -v` finds builtins and installed bundle commands
  - `export` affects subprocess env (WASI command exec)
  - `set -e` / `set -u` behavior for the supported subset

## Files (expected)

- Modify: `packages/tools/src/bash/builtins.ts`
- Modify: `packages/tools/src/bash/bash.ts`
- Modify: `packages/tools/src/command.ts` (expose installed command names for `command -v`)
- Add: `packages/tools/src/bash/__tests__/builtins.test.ts`

## Steps (TDD; one builtin per commit)

For each builtin:

1. Add failing unit test (red)
2. Implement minimal builtin (green)
3. Commit + push

