# v10 Feature 02: Expansion + Exit Code Semantics (`$?`, `${...}`, word splitting) (Implementation Plan)

> **Goal:** Make expansion + exit-code semantics predictable and POSIX-ish for the supported subset (enough to run real scripts).

## Scope

- Add an execution “state” concept to the shell runtime:
  - `lastExitCode` and `$?` expansion
  - a shell variable map and an env map (exported vars)
  - positional params `$1..$N` (minimal)
- Expansion order (subset, but not surprising):
  1. parameter expansion: `$var`, `${var}`, `${var:-default}`
  2. command substitution: `$(...)` (execute with captured stdout)
  3. pathname expansion: `* ? [...]` (start with `*` + `?`)
  4. field splitting (default IFS whitespace; configurable later)
- Fix correctness bugs:
  - empty unquoted expansions must not generate invalid argv elements

## Acceptance

- Unit tests cover:
  - `$?` behavior across `&&`/`||`
  - `${var:-default}`
  - empty expansion behavior (unquoted drops word; quoted preserves empty)
  - `$(...)` captures stdout and trims trailing newline (document exact behavior)

## Files (expected)

- Modify: `packages/tools/src/shell/exec.ts`
- Add: `packages/tools/src/shell/__tests__/expansion.test.ts`

## Steps (TDD; many small commits)

1. Add failing tests for empty expansion + `$?` (red).
2. Implement minimal state + expansion rules (green).
3. Commit + push.
4. Repeat for `${...}` then `$(...)`, each as separate commits.

