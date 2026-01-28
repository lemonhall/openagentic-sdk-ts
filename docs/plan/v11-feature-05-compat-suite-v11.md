# v11 Feature 05: Compatibility Suite Expansion (v11 Semantics) (Implementation Plan)

> **Goal:** Turn the v11 semantics into regression-proof fixtures that run in both backends.

## Scope

- Add fixtures for:
  - field splitting / quoting rules
  - vars vs env / export model
  - positional params / set / shift
  - exit / errexit / nounset
- Keep fixtures deterministic:
  - fixed env (`SOURCE_DATE_EPOCH`, `USER`, etc.)

## Acceptance

- `packages/tools/src/__tests__/shell-compat.test.ts` runs all fixtures and compares:
  - `stdout`, `stderr`, `exit_code`
- Regressions show a focused diff (fixture name + backend).

## Files

- Add: `packages/tools/src/__tests__/shell-compat/0x-*.sh`
- Add: matching `.stdout` / `.stderr` / `.exitcode`

## Steps (discipline)

Add one fixture per commit:

1. Add fixture files.
2. Run: `pnpm -C packages/tools test -- src/__tests__/shell-compat.test.ts`
3. Commit + push.

