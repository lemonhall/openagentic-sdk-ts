# v2 Feature 01: LLM Provider Types (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Define stable TS types for LLM providers and streaming events, aligned with OpenAI Responses semantics.

## Goal

Add a minimal provider abstraction so `AgentRuntime` can:

- call `provider.complete(...)` (non-streaming)
- optionally call `provider.stream(...)` (streaming)
- receive `assistant_text` + `tool_calls` consistently
- thread `previousResponseId` when supported

## Design (recommended)

Implement in `@openagentic/sdk-core`:

- `ModelProvider` interface (Responses-style)
- `ModelOutput` (assistantText + toolCalls + usage + raw + responseId)
- `ModelStreamEvent` union:
  - `text_delta`
  - `tool_call` (final tool call)
  - `done` (includes `responseId` + `usage`)

Align tool call shape with existing `ToolCall`:

- `toolUseId` (aka call_id)
- `name`
- `input` (parsed JSON arguments → `Record<string, unknown>`)

## Task 1: Add provider types to core

**Files:**
- Create: `packages/core/src/llm/types.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing type-level tests**

Add `packages/core/src/__tests__/llm-types.test.ts`:

- asserts `ModelProvider` can be implemented by an object with `complete`
- asserts `ModelStreamEvent` discriminated union narrows correctly

Run: `pnpm -C packages/core test`  
Expected: FAIL (types don’t exist)

**Step 2: Implement types**

Implement:

- `export type ModelToolCall = ToolCall;`
- `export type ModelOutput = { assistantText: string | null; toolCalls: ToolCall[]; usage?: Record<string, unknown>; raw?: unknown; responseId?: string | null; providerMetadata?: Record<string, unknown> }`
- `export type ModelCompleteInput = { model: string; input: unknown[]; tools?: unknown[]; apiKey?: string; previousResponseId?: string | null; instructions?: string | null; store?: boolean }`
- `export interface ModelProvider { readonly name: string; complete(req: ModelCompleteInput): Promise<ModelOutput>; stream?(req: ModelCompleteInput): AsyncIterable<ModelStreamEvent>; }`

**Step 3: Run tests**

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(core): add LLM provider types`

