# v10 Plans Index — POSIX-ish `sh` Compatibility (Shell Semantics + Minimal Toolchain)

> Goal of v10: make the “Bash” tool behave like a real shell (POSIX-ish `sh`) and ship enough builtins + coreutils-like commands that common scripts run without surprise.

## Why v10 exists

As of v8/v9, the repo has a working “restricted shell” that supports a small subset (pipes/redirection/`&&`/`||` + minimal `$VAR` + minimal `*` glob).

That subset is good enough for demos, but it is **not** POSIX `sh` compatible:

- Quoting and escaping are incomplete (no backslash escapes; no comments; no `;` sequencing; no grouping/subshell).
- Expansion and word splitting are incomplete (no `${...}`; no `$?`; empty expansions can produce invalid argv).
- Redirect semantics are simplified (only `<`/`>`/`>>`, last-command only; no `2>` / `2>&1`).
- Builtins are incomplete (`command`, `export`, `set`, `:` are missing).
- A minimal toolchain is missing (`date`, `uname`, `whoami`, search tools) so scripts fail with “unknown command”.

v10 is the version where we stop calling it “Bash” if it doesn’t act like one.

## v10 success criteria (hard)

1. Shell parser + executor supports a documented POSIX-ish subset:
   - quoting + escaping, comments, `;`, `&&`/`||`, pipelines, redirects, exit codes, `$?`
2. Builtins cover the usual scripting baseline:
   - `:` `true` `false` `echo` `printf` `cd` `pwd` `export` `unset` `set` `shift` `exit` `command -v`
3. Minimal toolchain exists (either as builtins or WASI applets) for common scripts:
   - `date` `uname` `whoami` and a practical search tool (`grep`/`rg`-like)
4. A compatibility test suite exists and runs in CI (guardrails against regressions).
5. **Engineering discipline:** every feature slice lands as an isolated commit with `git push` (no “big-bang” commits).

## Plans (suggested execution order)

1. `v10-feature-00-vision-posix.md`
2. `v10-feature-01-shell-lexer-parser.md`
3. `v10-feature-02-expansion-and-exit-codes.md`
4. `v10-feature-03-redirects-and-pipes.md`
5. `v10-feature-04-builtins-suite.md`
6. `v10-feature-05-minimal-toolchain.md`
7. `v10-feature-06-compat-tests.md`

