# v1-feature-09: WASI preview1 FS + args/env (Minimal)

Goal: make WASI modules usable as real CLI tools by providing:

- `argv` + `env` (WASI `args_*` / `environ_*`)
- A sandboxed, preopened root directory (fd=3)
- Minimal filesystem syscalls sufficient for simple read/write workflows

This remains “same semantics” across browser and server:

- Browser: in-process WASI runner uses a **virtual in-memory FS snapshot**.
- Server: wasmtime runner executes inside a **temp directory** seeded from the snapshot and returns the updated snapshot.

## Scope

### In

- `WasiExecInput.fs?: WasiFsSnapshot` and `WasiExecResult.fs?: WasiFsSnapshot`
- In-process runner implements:
  - `args_sizes_get`, `args_get`
  - `environ_sizes_get`, `environ_get`
  - `fd_prestat_get`, `fd_prestat_dir_name` (fd=3 preopen)
  - `path_open`, `fd_close`, `fd_read`, `fd_write`, `fd_seek`
- Wasmtime runner:
  - Fix CLI arg separation (`--`) so `argv` is passed correctly
  - Support `env` via `--env`
  - If `input.fs` is present: seed temp dir, run with `--dir`, return updated snapshot

### Out (future feature)

- Full POSIX-like coverage (`readdir`, `rename`, directory ops, stat, permissions, symlinks)
- Streaming large FS snapshots / incremental diffs (v1 uses whole-snapshot return)
- Exposing FS mounting from `@openagentic/workspace` automatically (tools wiring later)

## Files

- Modify: `packages/wasi-runner/src/types.ts`
- Modify: `packages/wasi-runner/src/index.ts`
- Modify: `packages/wasi-runner-web/src/in-process.ts`
- Modify: `packages/wasi-runner-web/src/__tests__/in-process.test.ts`
- Modify: `packages/wasi-runner-wasmtime/src/index.ts`
- Add: `packages/wasi-runner-wasmtime/src/wasmtime-args.ts`
- Add: `packages/wasi-runner-wasmtime/src/__tests__/wasmtime-args.test.ts`
- Modify: `docs/plan/index.md`

## TDD Tasks (Red → Green)

### Task 1: `argv` support (web runner)

1) **RED** Add a test in `packages/wasi-runner-web/src/__tests__/in-process.test.ts`:
   - Compile a small WAT module that prints `argv[0]` via `fd_write`.
   - Run `InProcessWasiRunner.execModule({ argv: ["echo"], ... })`.
   - Expect stdout to equal `"echo\n"`.
2) Run: `pnpm -C packages/wasi-runner-web test`
   - Expect fail: missing `args_sizes_get/args_get`.
3) **GREEN** Implement `args_sizes_get/args_get` in `packages/wasi-runner-web/src/in-process.ts`.
4) Re-run: `pnpm -C packages/wasi-runner-web test` and ensure pass.

### Task 2: FS write via `path_open` (web runner)

1) **RED** Add a test in `packages/wasi-runner-web/src/__tests__/in-process.test.ts`:
   - WAT module calls `path_open` on fd 3 for `"a.txt"` with `O_CREAT|O_TRUNC`, writes `"hello"`, closes.
   - Run with `fs: { files: {} }`.
   - Expect `res.fs.files["a.txt"]` to equal `"hello"`.
2) Run: `pnpm -C packages/wasi-runner-web test`
   - Expect fail: missing `path_open`/file fd semantics.
3) **GREEN** Implement minimal virtual FS + `path_open/fd_write/fd_close/fd_read/fd_seek` in `packages/wasi-runner-web/src/in-process.ts`.
4) Re-run: `pnpm -C packages/wasi-runner-web test` and ensure pass.

### Task 3: wasmtime CLI args correctness (no wasmtime needed)

1) **RED** Add a unit test in `packages/wasi-runner-wasmtime/src/__tests__/wasmtime-args.test.ts`:
   - Assert args include `--` before `argv`.
2) Run: `pnpm -C packages/wasi-runner-wasmtime test`
   - Expect fail until helper exists / used.
3) **GREEN** Implement `buildWasmtimeCliArgs` helper and use it from runner.
4) Re-run test and ensure pass.

### Task 4: Workspace parity scaffolding (wasmtime snapshot)

1) **RED** Add a test that exercises snapshot materialization + read-back helpers without invoking `wasmtime`:
   - Create a temp dir, write snapshot, read snapshot, assert equality.
2) **GREEN** Implement `writeSnapshotToDir` + `readSnapshotFromDir` helpers and use them when `input.fs` is provided.

## Verification

- `pnpm test`
- `git status` clean

