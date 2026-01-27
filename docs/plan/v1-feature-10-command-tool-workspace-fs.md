# v1-feature-10: CommandTool mounts Workspace as WASI FS

Goal: make WASI `Command(argv)` operate on the **shadow Workspace** by default, so WASI tools can read/write files without any host filesystem access.

## Scope

- `CommandTool` requires `workspace` in `ToolContext` (same pattern as `ShellTool`)
- On every command run:
  - Snapshot `Workspace` into `WasiFsSnapshot`
  - Execute WASI module with `fs` set to that snapshot
  - Commit the returned `fs` snapshot back into `Workspace`
- `Shell` execution passes `workspace` through to `CommandTool.run` so pipelines work.

## Files

- Modify: `packages/tools/src/command.ts`
- Modify: `packages/tools/src/shell/exec.ts`
- Modify: `packages/tools/src/__tests__/command.test.ts`
- Modify: `packages/tools/package.json` (dev dep for WAT compilation in tests)
- Modify: `docs/plan/index.md`

## TDD Tasks (Red → Green)

### Task 1: write a file via WASI tool

1) **RED** Add a test to `packages/tools/src/__tests__/command.test.ts`:
   - Create a minimal in-memory bundle that contains a WAT-compiled WASI module.
   - The module calls `path_open` and `fd_write` to create `a.txt` with `hello`.
   - Run `CommandTool.run({ argv: ["writefile"] }, { ..., workspace })`.
   - Assert `workspace.readFile("a.txt")` equals `hello`.
2) Run: `pnpm -C packages/tools test` and confirm failure (file not present).
3) **GREEN** Implement snapshot mount + commit-back in `packages/tools/src/command.ts`.
4) Re-run: `pnpm -C packages/tools test` and ensure pass.

### Task 2: preserve Shell behavior

1) Ensure `packages/tools/src/shell/exec.ts` passes `workspace` in the `ToolContext` it uses for `CommandTool.run`.
2) Run: `pnpm -C packages/tools test` and confirm `shell-tool.test.ts` remains green.

## Verification

- `pnpm test`
- `git status` clean

