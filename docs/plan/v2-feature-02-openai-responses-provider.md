# v2 Feature 02: OpenAI Responses Provider (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Implement a real provider that can talk to OpenAI Responses API from both Node and browser.

## Goal

Create `@openagentic/providers-openai` with:

- `OpenAIResponsesProvider.complete()` using `fetch`
- `OpenAIResponsesProvider.stream()` parsing SSE and emitting `ModelStreamEvent`
- Hard security rule: **never send cookies** (`credentials: "omit"` in browsers)

## Design notes

- Use global `fetch` by default; allow injection for tests.
- Support `baseUrl` override for OpenAI-compatible gateways.
- Parse tool calls from:
  - non-streaming: response `output[]` items where `type === "function_call"`
  - streaming: `response.output_item.added` + `response.function_call_arguments.delta` + `response.output_item.done`

## Task 1: Create the package

**Files:**
- Create: `packages/providers-openai/package.json`
- Create: `packages/providers-openai/tsconfig.build.json`
- Create: `packages/providers-openai/src/index.ts`
- Create: `packages/providers-openai/src/responses.ts`
- Modify: `pnpm-workspace.yaml`

**Step 1: Add a failing unit test**

Create: `packages/providers-openai/src/__tests__/responses-complete.test.ts`

- stubs `globalThis.fetch`
- asserts it calls `POST {baseUrl}/responses`
- asserts browser-safe: `credentials: "omit"` is set when available (on RequestInit)
- returns a minimal JSON response and asserts parsing:
  - `assistantText`
  - `toolCalls[]` with parsed JSON arguments
  - `responseId`

Run: `pnpm -C packages/providers-openai test`  
Expected: FAIL (package/provider missing)

**Step 2: Implement `complete()`**

Implement in `packages/providers-openai/src/responses.ts`.

**Step 3: Run tests**

Run: `pnpm -C packages/providers-openai test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(openai): add Responses complete()`

## Task 2: Add SSE streaming support

**Files:**
- Create: `packages/providers-openai/src/sse.ts`
- Modify: `packages/providers-openai/src/responses.ts`
- Test: `packages/providers-openai/src/__tests__/responses-stream.test.ts`

**Step 1: Write failing streaming test**

- Provide a fake `fetch` that returns a `ReadableStream` (or a polyfilled async iterator) with SSE lines.
- Assert provider yields:
  - `text_delta` events in order
  - a `tool_call` event once arguments complete
  - a final `done` event with usage + responseId

Run: `pnpm -C packages/providers-openai test`  
Expected: FAIL (no streaming)

**Step 2: Implement**

- Minimal SSE parser that:
  - splits by `\n`
  - reads `data: ...` lines
  - treats `data: [DONE]` as terminal

**Step 3: Run tests**

Run: `pnpm -C packages/providers-openai test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(openai): add Responses stream()`

