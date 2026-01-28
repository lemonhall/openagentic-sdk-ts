# v10 Feature 06: Shell Compatibility Test Suite (Guardrails) (Implementation Plan)

> **Goal:** Add a repeatable compatibility suite so “POSIX-ish” claims stay true over time.

## Strategy

- Start with a curated set of small `.sh` fixtures that exercise the supported subset.
- Execute them in:
  - TS-native BashTool (pure TS builtins)
  - WASI-backed BashTool (official bundles)
- Keep tests deterministic by:
  - providing fixed env vars
  - avoiding real time unless overridden by env (`SOURCE_DATE_EPOCH`)

## Acceptance

- CI runs a single test entrypoint that:
  - executes all fixtures
  - compares stdout/stderr/exit codes to golden expectations
- Regressions show a focused diff.

## Files (expected)

- Create: `packages/tools/src/__tests__/shell-compat/*.sh`
- Create: `packages/tools/src/__tests__/shell-compat.test.ts`

## Steps (TDD; fixture-by-fixture)

Add one fixture at a time, commit + push after each new fixture.

