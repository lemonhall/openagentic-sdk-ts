# v12 Feature 02: `rg` Wiring (BashTool) + Fallback Semantics

## Goal

Ensure that when users run `rg ...` inside `BashTool`, they get upstream ripgrep behavior by default (WASI-backed), and a clear deterministic fallback story when WASI is disabled.

## Scope

- Prefer WASI `rg` when:
  - `BashTool` is configured with `wasiCommand`, and
  - the installed bundles include `rg`.
- Keep the existing TS builtin `rg` as a fallback only.
- Make `command -v rg` report correctly in both cases.

## Acceptance

- In WASI mode:
  - `rg` runs via `CommandTool` and matches snapshots/behavior.
- In TS-only mode:
  - `rg` continues to work for the currently-supported subset, but:
    - rejects unsupported flags with exit code 2 (usage error),
    - prints a clear error message mentioning it is a limited fallback.

## Files

- Modify:
  - `packages/tools/src/bash/bash.ts`
  - `packages/tools/src/bash/builtins.ts`

## Steps (TDD)

1. RED: write tests covering `command -v rg` and `rg --help` behavior in WASI-enabled mode.
2. GREEN: implement command resolution preference rules.
3. RED: write tests for TS-only mode rejecting unknown flags with exit code 2.
4. GREEN: implement flag parsing + error behavior for the fallback.
5. Ship:
   - `git commit -m "v12: wire rg to WASI by default"`
   - `git push`

