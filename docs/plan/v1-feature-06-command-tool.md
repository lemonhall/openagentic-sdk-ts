# v1-feature-06 — `Command(argv)` Tool

## Goal

Expose `Command(argv)` as a first-class tool backed by the WASI runner and tool bundles.

## Deliverables

- Tool schema for `Command`:
  - primary input is `argv: string[]`
  - supports `cwd`, `env`, `stdin`, limits (timeout, max bytes), and a working directory inside shadow workspace
- Resource limits and truncation are consistent across runners
- Events include:
  - command start (argv, cwd, limits)
  - command end (exit code, stdout/stderr sizes, truncation flag)

## Files

Create/modify (suggested):

- `packages/tools/src/command.ts`
- `packages/core/src/__tests__/command-tool.test.ts`

## Steps (TDD)

1. Red: `Command(["echo","hi"])` returns expected stdout
2. Green: wire to `WasiRunner`
3. Red: truncation + timeout behavior
4. Green: implement limits consistently

## Acceptance checks

- Works in browser (web runner) and server (wasmtime runner) with identical output semantics.

