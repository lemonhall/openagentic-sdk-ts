# v1-feature-00 — Foundation (repo scaffold)

## Goal

Create the minimal project structure to support a multi-package TS SDK with tests and docs.

## Deliverables

- Monorepo scaffold (`pnpm` workspace recommended; choose and document the package manager)
- `packages/` layout for core/runtime, web runner, wasmtime runner, and tools
- Test runner setup (recommend `vitest`)
- A “hello runtime” placeholder test that proves the harness runs

## Files

Create/modify:

- `package.json`
- `pnpm-workspace.yaml` (or chosen workspace equivalent)
- `tsconfig.json`
- `packages/core/package.json`
- `packages/core/src/index.ts`
- `packages/core/src/__tests__/smoke.test.ts`

## Steps (executable)

1. Initialize workspace (example for `pnpm`)
   - Command: `pnpm init`
   - Expected: root `package.json` exists
2. Add tooling
   - Command: `pnpm add -D typescript vitest`
   - Expected: `pnpm-lock.yaml` updates, `vitest` runnable
3. Add `vitest` smoke test
   - Command: `pnpm vitest run`
   - Expected: 1 passing test

## Notes

Keep the initial toolchain minimal. Avoid bundlers until needed for browser packaging.

