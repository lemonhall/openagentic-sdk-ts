# v1-feature-07 — `Shell(script)` Tool (subset B)

## Goal

Provide a Bash-like user experience via a `Shell(script)` tool that compiles a restricted shell syntax into `Command(argv)` steps.

## Shell subset (B)

Supported (v1):

- Pipelines: `|`
- Redirects: `<`, `>`, `>>`
- Conditionals: `&&`, `||`
- Basic quoting: single and double quotes
- `$VAR` expansion (host-provided env)
- Simple globbing (host expands against shadow workspace)

Explicitly not supported (v1; record for future):

- heredoc, subshells, command substitution, job control, complex parameter expansion

## Deliverables

- Parser → AST
- Compiler → pipeline execution plan
- Executor:
  - connects stdout→stdin between `Command` steps
  - implements redirects via workspace file reads/writes
  - applies `&&/||` semantics based on exit codes

## Files

Create/modify (suggested):

- `packages/tools/src/shell/parser.ts`
- `packages/tools/src/shell/compile.ts`
- `packages/tools/src/shell/exec.ts`
- `packages/tools/src/shell.ts`
- `packages/tools/src/__tests__/shell-tool.test.ts`

## Steps (TDD)

1. Red: parse pipelines and redirects into AST
2. Green: implement parser
3. Red: execute `echo hi | cat` (or equivalent) via `Command` plan
4. Green: implement compiler+executor
5. Red: glob expansion and `$VAR`
6. Green: implement expansions

## Acceptance checks

- Same script yields same results in browser and server.
- Tools only operate inside shadow workspace.

