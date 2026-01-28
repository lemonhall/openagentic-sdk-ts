# v11 Plans Index — POSIX-ish `sh` Semantics: Variables + Field Splitting + Positional Params

> Goal of v11: close the biggest remaining POSIX `sh` gaps that make real scripts behave “surprisingly”: **variable scoping (shell vars vs env)**, **field splitting (IFS)**, and **positional parameters**.

## Why v11 exists (gap review vs POSIX `sh`)

As of v10, we have a working “POSIX-ish” shell core:

- Lexer/parser: quoting (`'`/`"`), escapes, comments, `;` sequencing, `&&`/`||`, pipelines, redirects, subshell grouping.
- Expansion subset: `$var`, `${var}`, `${var:-default}`, `$?`, and `$(...)` command substitution (captured stdout; trims one trailing newline).
- Redirect subset: `<`, `>`, `>>`, `2>`, `2>>`, `2>&1`, `1>&2` (with ordering).
- Assignments: `FOO=bar cmd ...` and standalone `FOO=bar` (currently stored in a single env map).
- A growing builtin/tool baseline (via `BashTool`): `:`/`true`/`false`, `echo`, `printf`, `test`/`[`, `cd`/`pwd`, `export`/`unset`, `command -v`, plus a pragmatic `date`/`uname`/`whoami`/`rg`.
- Guardrails: a shell-compat fixture harness exists.

However, we are still far from POSIX `sh` in the ways that break scripts:

1. **No field splitting**: unquoted expansions/command substitutions do not split on IFS, so argv differs from POSIX.
2. **No shell variable map**: “variables” are treated as env; non-exported vars don’t exist as a concept.
3. **No positional params**: `$1..$N`, `$#`, `$@`/`$*`, `set -- ...`, `shift` aren’t implemented.
4. **No `exit` / `set -e` / `set -u` execution controls** (some scripts rely heavily on these).

v11 addresses (1)-(3) as the mandatory semantic core, and adds only the minimal control plumbing needed to test them reliably.

## v11 success criteria (hard)

1. Separate **shell vars** and **env**:
   - `FOO=bar` persists as a shell var (expandable) but is not exported to subprocesses unless exported.
   - `export FOO` exports existing shell var to env.
   - Prefix assignments (`FOO=bar cmd`) affect only that command’s environment.
2. Implement **field splitting** (IFS) for unquoted expansions and unquoted `$(...)` results:
   - Default IFS: space/tab/newline.
   - Quoted expansions preserve whitespace (no splitting).
3. Implement **positional parameters**:
   - `$1..$N`, `$#`, `$@`, `$*` (minimal), `set -- ...`, `shift`.
4. Compatibility tests cover the new semantics (fixtures + unit tests) and run in CI.
5. Engineering discipline: each feature slice lands as an isolated commit with `git push`.

## Preflight

Before starting (or resuming) v11 work:

- `preflight-checklist.md`

## Plans (suggested execution order)

1. `v11-feature-00-posix-gap-audit.md`
2. `v11-feature-01-shell-vars-vs-env.md`
3. `v11-feature-02-field-splitting-ifs.md`
4. `v11-feature-03-positional-params-set-shift.md`
5. `v11-feature-04-exit-and-errexit-nounset.md`
6. `v11-feature-05-compat-suite-v11.md`

