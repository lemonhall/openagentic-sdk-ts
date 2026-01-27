# v2 Feature 06: Node Runner Demo (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Add a runnable Node demo package that wires the v2 stack end-to-end against a real LLM backend.

## Goal (user-visible)

Create a runnable Node demo that:

- runs an interactive multi-turn chat loop (stdin)
- streams assistant text
- supports tool calling (workspace file tools)
- persists sessions to disk (JSONL)
- operates on a *shadow workspace* by default and only writes to the real FS on explicit “commit”

## Design (decisions)

- The demo lives as a pnpm workspace package: `packages/demo-node` (so `pnpm -r build && pnpm -r test` stays meaningful).
- The demo defaults to safe tools only:
  - `ReadFileTool`, `WriteFileTool`, `ListDirTool`
  - `Shell`/`Command` are optional and must be explicitly enabled (WASI tool bundles are v3+).
- Session persistence uses `JsonlSessionStore` + `createNodeJsonlBackend()` rooted at `.openagentic/sessions`.
- Shadow workspace model:
  - import from a real directory into `MemoryWorkspace`
  - track baseline snapshot (`snapshotWorkspace`)
  - on `/commit`, apply adds/modifies/deletes back to the real directory

## Acceptance (hard)

- `pnpm test` passes
- Manual run works:
  - `OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project /path/to/project`
  - you can chat multiple turns, and the session is saved under `.openagentic/sessions/<sessionId>/events.jsonl`
  - file tools can read/write inside the shadow workspace
  - `/commit` writes the shadow changes back to the real directory

---

## Task 1: Create the demo package skeleton

**Files:**
- Create: `packages/demo-node/package.json`
- Create: `packages/demo-node/tsconfig.build.json`
- Create: `packages/demo-node/src/index.ts`
- Create: `packages/demo-node/src/main.ts`

**Step 1: Add a failing “public API exists” test**

File: `packages/demo-node/src/__tests__/smoke.test.ts`

- Expect the demo exports a `runCli(args)` function (or similar) so we can test it without spawning a real process.

Run: `pnpm -C packages/demo-node test`  
Expected: FAIL (missing module/export)

**Step 2: Minimal implementation**

- Implement `runCli(args)` with a stub that returns a structured result (no real provider wiring yet).

Run: `pnpm -C packages/demo-node test`  
Expected: PASS

**Step 3: Commit**

Commit message: `feat(demo): scaffold node runner`

---

## Task 2: Wire the runtime with a fake provider (TDD)

**Files:**
- Modify: `packages/demo-node/src/index.ts`
- Create: `packages/demo-node/src/runtime.ts`
- Test: `packages/demo-node/src/__tests__/runtime-wire.test.ts`

**Step 1: Write a failing test**

- Use a `FakeProvider` that returns:
  - one assistant message without tool calls
  - then a second run that requests a workspace tool call
- Assert:
  - `AgentRuntime.runTurn()` appends the expected events
  - tool results are appended and the loop continues

Run: `pnpm -C packages/demo-node test`  
Expected: FAIL

**Step 2: Minimal implementation**

- Add `createDemoRuntime({ sessionStore, toolRunner, provider })`.

Run: `pnpm -C packages/demo-node test`  
Expected: PASS

**Step 3: Commit**

Commit message: `feat(demo): wire AgentRuntime with fake provider`

---

## Task 3: Real OpenAI provider path + streaming renderer

**Files:**
- Modify: `packages/demo-node/src/main.ts`
- Create: `packages/demo-node/src/openai.ts`
- Create: `packages/demo-node/src/render.ts`
- Test: `packages/demo-node/src/__tests__/render.test.ts`

**Step 1: Write a failing test for rendering**

- Given a sequence of events (user message, assistant delta chunks, assistant message), verify the renderer produces a stable textual transcript.

Run: `pnpm -C packages/demo-node test`  
Expected: FAIL

**Step 2: Implement renderer**

- Implement a line-based renderer that:
  - streams deltas in-place
  - prints tool calls/results clearly

Run: `pnpm -C packages/demo-node test`  
Expected: PASS

**Step 3: Add OpenAI provider wiring (no tests; manual)**

- Read `OPENAI_API_KEY` from env; fail fast with a clear error if missing.
- Use `OpenAIResponsesProvider` from `@openagentic/providers-openai`.

Run (manual): `OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project .`  
Expected: you can chat and see streaming output

**Step 4: Commit**

Commit message: `feat(demo): add OpenAI streaming CLI`

---

## Task 4: Shadow workspace import + commit back to real FS

**Files:**
- Create: `packages/demo-node/src/workspace-shadow.ts`
- Modify: `packages/demo-node/src/main.ts`
- Test: `packages/demo-node/src/__tests__/shadow-workspace.test.ts`

**Step 1: Write a failing test**

- Use a temp directory fixture:
  - create a real file `a.txt`
  - import into shadow (MemoryWorkspace)
  - modify `a.txt` in shadow
  - run commit
  - assert real `a.txt` changed and only on commit

Run: `pnpm -C packages/demo-node test`  
Expected: FAIL

**Step 2: Minimal implementation**

- Implement:
  - `importLocalDirToShadow(realDir, shadowWorkspace)`
  - `commitShadowToLocalDir({ realDir, shadowWorkspace, baseSnapshot })`
- Use `snapshotWorkspace` + `computeChangeSet` for reporting/applying changes.

Run: `pnpm -C packages/demo-node test`  
Expected: PASS

**Step 3: Manual**

- Add `/status` (show changeset) and `/commit` commands.

**Step 4: Commit**

Commit message: `feat(demo): add shadow workspace commit flow`
