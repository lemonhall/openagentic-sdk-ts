# v11 Feature 03: Positional Parameters (`$1`, `$@`, `set --`, `shift`) (Implementation Plan)

> **Goal:** Add the minimal positional parameter model needed for real `sh` scripts and test harnesses.

## Scope

- Represent positional params in shell state: `argv: string[]` (excluding `$0` initially).
- Expansions:
  - `$1..$N`
  - `$#`
  - `$@` / `$*` (minimal subset; document exact behavior for now)
- Builtins:
  - `set -- a b c` replaces positional params
  - `shift [n]` shifts params (default 1)

## Acceptance

- Compat fixtures cover:
  - `set -- a b; echo $1 $2 $#`
  - `shift; echo $1 $#`
  - `printf "%s\\n" "$@"` preserves argument boundaries (document minimal subset if not fully POSIX yet)

## Files (expected)

- Modify: `packages/tools/src/shell/exec.ts`
- Modify: `packages/tools/src/bash/builtins.ts`
- Add tests: `packages/tools/src/shell/__tests__/positional.test.ts`
- Add compat fixture(s): `packages/tools/src/__tests__/shell-compat/`

## Steps (TDD; small commits)

1. Add failing tests for `$1`/`$#`.
2. Implement state + expansions.
3. Add `set`/`shift` builtins.
4. Commit + push.

