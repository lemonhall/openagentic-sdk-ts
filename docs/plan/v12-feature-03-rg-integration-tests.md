# v12 Feature 03: `rg` Integration Tests (Behavior Parity)

## Goal

Lock in real behavior parity beyond `--help` output: searching, ignore rules, exit codes, and formats.

## Scope (prioritized)

Add a fixture-based compatibility suite for `rg` that runs in:

- Node (WASI runner)
- Browser (demo-web WASI runner) where feasible

Cover at least:

1. Exit codes:
   - matches → 0
   - no matches → 1
   - usage error → 2
2. Ignore behavior:
   - `.gitignore` / `.ignore` (basic)
   - `--hidden`, `--no-ignore`, `-uuu`
3. Output formats:
   - default output
   - `-n` line numbers
   - `--json` (parse + assert key fields)
4. Traversal:
   - `--files`, `--files-with-matches`
   - `--glob` include/exclude patterns

## Acceptance

- A deterministic test suite exists with small synthetic workspaces.
- Tests run fast and do not require network.

## Files

- Add:
  - `packages/tools/src/__tests__/rg-compat/` fixtures (inputs + expected outputs)
  - `packages/tools/src/__tests__/rg-compat.test.ts`

## Steps (TDD)

Repeat per fixture:

1. RED: add fixture + expected stdout/stderr/exit_code.
2. GREEN: fix wiring/bundle/fs until it passes.
3. Ship one fixture per commit:
   - `git commit -m "v12: rg compat <name>"`
   - `git push`

