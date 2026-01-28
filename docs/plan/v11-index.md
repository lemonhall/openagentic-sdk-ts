# v11 Plans Index — POSIX-ish `sh` Semantics: Variables + Field Splitting + Positional Params

> Goal of v11: close the biggest remaining POSIX `sh` gaps that make real scripts behave “surprisingly”: **variable scoping (shell vars vs env)**, **field splitting (IFS)**, and **positional parameters**.

## Why v11 exists (gap review vs POSIX `sh`)

As of v10, we have a working “POSIX-ish” shell core:

- Lexer/parser: quoting (`'`/`"`), escapes, comments, `;` sequencing, `&&`/`||`, pipelines, redirects, subshell grouping.
- Expansion subset: `$var`, `${var}`, `${var:-default}`, `$?`, and `$(...)` command substitution (captured stdout; trims one trailing newline — POSIX strips all trailing newlines).
- Redirect subset: `<`, `>`, `>>`, `2>`, `2>>`, `2>&1`, `1>&2` (with ordering).
- Assignments: `FOO=bar cmd ...` and standalone `FOO=bar` (v10: treated as env; v11: split vars vs env).
- A growing builtin/tool baseline (via `BashTool`): `:`/`true`/`false`, `echo`, `printf`, `test`/`[`, `cd`/`pwd`, `export`/`unset`, `set`/`shift`, `command -v`, plus pragmatic `date`/`uname`/`whoami`/`rg`, and now `head`/`find`.
- Guardrails: a shell-compat fixture harness exists.

v11 focuses on the semantic gaps that change argv/control-flow in real scripts (vars vs env, IFS field splitting, positional params), and adds only minimal control plumbing (`exit`, `set -e`, `set -u`) to make those behaviors testable.

We are still far from POSIX `sh` overall. Major remaining gaps:

- **Language constructs**: `if/then/else`, `case`, `for/while/until`, functions, `trap`, `.`/`source`, `read`, `eval`, `local`, `return`.
- **Expansions/globbing**: pathname expansion (`* ? []`), arithmetic expansion/eval, full parameter expansion surface (`:=`, `:?`, `%`/`%%`, `#`/`##`, `${#var}`), all-trailing-newline trim for `$(...)`.
- **Redirections**: heredocs (`<<`), fd juggling (`n<&`, `n>&`), `<>`, `>|`, etc.
- **Jobs/process**: background `&`, `wait`, signals/job control.
- **Utilities**: only a tiny subset exists; many scripts assume `sed`, `awk`, `cut`, `sort`, `tail`, `wc`, `xargs`, `env`, etc.

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

## Notes (living)

- Extra v11 follow-ups landed outside the original v11 plan docs:
  - `pwd` prints `.` at workspace root; added minimal `head` and `find` builtins (workspace-aware).
  - Demo-web persists bundle assets in IndexedDB to reduce repeat `.wasm` fetches after reloads.
