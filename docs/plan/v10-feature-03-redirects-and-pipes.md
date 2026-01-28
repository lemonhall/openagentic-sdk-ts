# v10 Feature 03: Redirects + Pipes with POSIX-ish FD Semantics (Implementation Plan)

> **Goal:** Make redirects and pipelines behave predictably (like a real shell) using a simple FD model that works in browser + server.

## Scope

- Redirect parsing:
  - `>` `>>` `<`
  - `2>` and `2>&1` (minimum set)
  - allow redirects on any command in a pipeline (not only “last command”)
- Execution model:
  - adopt an explicit FD/stream abstraction for stdin/stdout/stderr
  - pipeline connects stdout→stdin between commands
  - redirects override the default streams
- Keep safety limits:
  - max bytes for stdout/stderr per command and per pipeline

## Acceptance

- Tests cover:
  - `echo hi > out.txt` writes file and produces empty stdout
  - `cmd 2> err.txt` captures stderr
  - `cmd 2>&1 | grep ...` works as expected
  - multi-step pipelines preserve exit codes (documented policy)

## Files (expected)

- Modify: `packages/tools/src/shell/parser.ts`
- Modify: `packages/tools/src/shell/exec.ts`
- Add: `packages/tools/src/shell/__tests__/redirects.test.ts`

## Steps (TDD; many small commits)

Land each redirect/operator in its own commit with tests and `git push`.

