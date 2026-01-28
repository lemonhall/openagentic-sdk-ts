# v10 Feature 01: POSIX-ish Shell Lexer/Parser (Quoting, Escapes, Separators) (Implementation Plan)

> **Goal:** Replace the current “tokenize by whitespace and quotes” shell parser with a POSIX-ish lexer + parser that can represent real shell scripts (within a strict subset).

## Scope

- Lexer:
  - whitespace handling
  - comments `# ...` when unquoted
  - quoting: `'...'`, `"..."`, and `\` escapes (at least outside single quotes)
  - operators: `;`, newline, `&&`, `||`, `|`, redirects
- Parser:
  - sequences separated by `;` / newline
  - pipelines
  - command with assignments prefix (`FOO=bar cmd ...`) and env propagation
  - grouping: `(...)` subshell (as “new execution context”; env changes do not leak)

## Acceptance

- Add focused unit tests for parsing:
  - quoting + escapes
  - comments
  - `;` sequencing
  - grouping + precedence
- Existing `ShellTool` and `BashTool` tests updated to the new parser without regressions.

## Files (expected)

- Modify: `packages/tools/src/shell/parser.ts`
- Add: `packages/tools/src/shell/__tests__/parser.test.ts`
- Modify: `packages/tools/src/__tests__/shell-tool.test.ts`
- Modify: `packages/tools/src/__tests__/bash-tool.test.ts`

## Steps (TDD; many small commits)

For each sub-slice:

1. Add one failing parser test (red).
2. Implement minimal lexer/parser change (green).
3. Refactor (still green).
4. Commit + push (one slice per commit).

