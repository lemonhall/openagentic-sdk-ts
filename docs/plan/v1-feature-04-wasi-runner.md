# v1-feature-04 — WASI Runner (web + wasmtime)

## Goal

Define a single WASI runner interface and implement:

- Browser runner (WebWorker + web WASI shim)
- Server runner (wasmtime)

Both must run the same tool bundle modules with the same semantics.

## Deliverables

- `WasiRunner` interface: `execModule({ moduleRef, argv, env, cwd, mounts, stdin, limits })`
- FS mount contract: mount shadow workspace as the only preopened writable root
- Host capabilities: time, randomness, and injected `fetch` (see v1-feature-08)

## Files

Create/modify (suggested):

- `packages/wasi-runner/src/types.ts`
- `packages/wasi-runner-web/src/worker.ts`
- `packages/wasi-runner-web/src/index.ts`
- `packages/wasi-runner-wasmtime/src/index.ts`
- `packages/wasi-runner/src/__tests__/contract.test.ts`

## Steps

1. Red: contract tests for `execModule` result shape and truncation behavior
2. Green: minimal web runner that can execute a tiny “echo” wasm module
3. Green: wasmtime runner that executes the same module and matches output

## Acceptance checks

- Same module + same argv yields same stdout/stderr/exitCode in browser and server.

