# v2 Feature 04: Agent Runtime Loop (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Implement the core “agent loop” that ties LLM calls and tools into an event-sourced session.

## Goal

Add `AgentRuntime` to `@openagentic/sdk-core` that:

- creates / resumes sessions (`SessionStore`)
- appends user messages
- calls an LLM provider using rebuilt input
- streams assistant deltas as `assistant.delta` events
- appends assistant final message as `assistant.message`
- runs tool calls via `ToolRunner`, appends tool events, continues until no tool calls

## Design (minimum viable)

- Provider protocol: OpenAI Responses-style `input[]` with `previousResponseId` threading.
- Runtime loop:
  1. `system.init` (once per session creation)
  2. append `user.message`
  3. rebuild `input[]` from events (`rebuildResponsesInput`)
  4. call provider (stream if available, else complete)
  5. if tool calls:
     - append `tool.use` (from ToolRunner)
     - append `tool.result`
     - continue loop
  6. else:
     - append `result` and stop

## Task 1: Add runtime options + skeleton

**Files:**
- Create: `packages/core/src/runtime/options.ts`
- Create: `packages/core/src/runtime/agent-runtime.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/agent-runtime-smoke.test.ts`

**Step 1: Write failing smoke test**

- Use an in-memory `SessionStore` backend (create a tiny test backend).
- Use a fake provider that returns `assistantText: "hello"` and no tool calls.
- Assert events emitted in order:
  - `system.init`
  - `user.message`
  - `assistant.message`
  - `result`

Run: `pnpm -C packages/core test`  
Expected: FAIL

**Step 2: Implement minimal `AgentRuntime.runTurn()`**

API sketch:

- `constructor({ sessionStore, toolRunner, provider, model, apiKey?, systemPrompt? })`
- `runTurn({ sessionId?, userText }): AsyncIterable<Event>` (creates a session if missing)

**Step 3: Run tests**

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(core): add agent runtime skeleton`

## Task 2: Tool-call loop

**Files:**
- Modify: `packages/core/src/runtime/agent-runtime.ts`
- Test: `packages/core/src/__tests__/agent-runtime-tools.test.ts`

**Step 1: Write failing test**

- Fake provider:
  - first call returns `toolCalls: [{ toolUseId: "t1", name: "Echo", input: { text: "hi" } }]`
  - second call returns `assistantText: "done"`
- Tool registry contains `Echo` tool that returns `{ echoed: text }`.
- Assert the event log includes:
  - `tool.use` (Echo)
  - `tool.result` with echoed output
  - then `assistant.message` "done"

Run: `pnpm -C packages/core test`  
Expected: FAIL

**Step 2: Implement tool-call continuation**

- After model output with tool calls:
  - run each tool call through `ToolRunner.run(sessionId, toolCall)`
  - continue loop (increment steps; cap by `maxSteps`)

**Step 3: Run tests**

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(core): support tool-call loop`

## Task 3: Streaming deltas

**Files:**
- Modify: `packages/core/src/runtime/agent-runtime.ts`
- Test: `packages/core/src/__tests__/agent-runtime-stream.test.ts`

**Step 1: Write failing test**

- Fake provider `stream()` yields:
  - `text_delta` "hel"
  - `text_delta` "lo"
  - `done`
- Assert runtime yields `assistant.delta` events and then a final `assistant.message` "hello".

Run: `pnpm -C packages/core test`  
Expected: FAIL

**Step 2: Implement**

- Accumulate deltas into final text
- Emit `assistant.delta` per delta
- On `done`, append `assistant.message` and proceed with tool-call handling if any tool calls were emitted by stream

**Step 3: Run tests**

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(core): add streaming support`

