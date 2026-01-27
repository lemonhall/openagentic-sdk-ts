# v1-feature-11: ToolRunner context injection

Goal: allow the host application to inject per-session/per-call context (e.g. `workspace`) into tool execution, without hard-coding any domain objects into `@openagentic/sdk-core`.

This is required because many tools (e.g. `Shell`, `Command`) need access to the shadow `Workspace`, but `ToolRunner` currently constructs a minimal `ToolContext` with only `{ sessionId, toolUseId }`.

## Scope

- Add `contextFactory?: (sessionId, toolCall) => Record<string, unknown> | Promise<Record<string, unknown>>` to `ToolRunnerOptions`.
- `ToolRunner.run()` merges the extra context into the `ToolContext` passed to `tool.run()`, without allowing overrides of `sessionId` / `toolUseId`.

## Files

- Modify: `packages/core/src/runtime/tool-runner.ts`
- Modify: `packages/core/src/__tests__/tool-runner.test.ts`
- Modify: `docs/plan/index.md`

## TDD Tasks (Red → Green)

1) **RED** Extend `packages/core/src/__tests__/tool-runner.test.ts`:
   - Provide a `contextFactory` that returns `{ workspace: { tag: "w" } }`.
   - The tool returns `{ workspaceTag: (ctx as any).workspace?.tag }`.
   - Assert result output equals `"w"`.
2) Run: `pnpm -C packages/core test` and confirm failure.
3) **GREEN** Implement `contextFactory` merge in `packages/core/src/runtime/tool-runner.ts`.
4) Re-run: `pnpm -C packages/core test` and ensure pass.

## Verification

- `pnpm test`
- `git status` clean

