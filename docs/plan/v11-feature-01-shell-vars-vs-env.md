# v11 Feature 01: Shell Variables vs Environment (Export Model) (Implementation Plan)

> **Goal:** Introduce a POSIX-ish variable model: shell vars persist; env is the exported subset; prefix assignments are per-command only.

## Scope

- Add a shell “state” object:
  - `vars: Record<string, string>` (shell variables)
  - `env: Record<string, string>` (exported vars only)
  - `lastExitCode`
  - `positional` (added in Feature 03)
- Semantics:
  - `FOO=bar` sets `vars.FOO = "bar"` and (if `FOO` is currently exported) also updates `env.FOO`.
  - `export FOO` adds `FOO` to exported set and copies `vars.FOO` (or empty string) into `env.FOO`.
  - `unset FOO` removes from `vars` and `env` (minimal subset).
  - Prefix assignments (`FOO=bar cmd`) affect only that command’s environment and do not mutate parent shell vars/env.

## Acceptance

- Unit tests demonstrate:
  - `FOO=bar; echo $FOO` prints `bar`
  - `FOO=bar; command-that-prints-env` does not see `FOO` unless `export FOO`
  - Prefix assignment does not persist after the command

## Files (expected)

- Modify: `packages/tools/src/shell/exec.ts`
- Modify: `packages/tools/src/bash/builtins.ts` (export/unset should operate on shell state, not only env)
- Add tests: `packages/tools/src/shell/__tests__/vars.test.ts`

## Steps (TDD; small commits)

1. Add failing tests for “shell var persists but not exported”.
2. Implement `vars/env/exported` separation in the executor.
3. Wire `export`/`unset` builtins to the new state.
4. Commit + push.

