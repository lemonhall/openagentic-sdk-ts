# v11 Feature 02: Field Splitting (IFS) (Implementation Plan)

> **Goal:** Implement POSIX-ish field splitting so unquoted expansions behave like `sh` and scripts don’t silently change argv shape.

## Scope

- Default IFS: space, tab, newline.
- Apply splitting to:
  - unquoted parameter expansion results
  - unquoted command substitution results
- Do not split:
  - single-quoted
  - double-quoted
  - mixed-quoted words (treat as quoted for splitting purposes)
- After splitting, apply pathname expansion (`*` initially; extend later).

## Acceptance

- Compat fixtures cover:
  - `x="a b"; printf "%s\\n" $x` prints two lines (`a` then `b`)
  - `x="a  b"; printf "%s\\n" $x` collapses runs of IFS into separators (document exact subset behavior)
  - `printf "%s\\n" "$x"` prints one line with space preserved

## Files (expected)

- Modify: `packages/tools/src/shell/exec.ts`
- Add tests: `packages/tools/src/shell/__tests__/ifs.test.ts`
- Add compat fixture(s): `packages/tools/src/__tests__/shell-compat/`

## Steps (TDD; per-fixture commit)

1. Add failing compat fixture for field splitting.
2. Implement minimal splitting logic and keep quoting rules correct.
3. Commit + push.

