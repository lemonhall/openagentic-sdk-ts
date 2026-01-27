# v2 Feature 03: Tool Schemas for OpenAI (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Let the model discover and call tools by turning `ToolRegistry` into OpenAI tool schema payloads.

## Goal

Implement helpers in `@openagentic/sdk-core`:

- `toolSchemasForOpenAIResponses(registry, allowedToolNames?)` → `tools[]` payload for OpenAI Responses
- (optional) `toolSchemasForOpenAIChat(...)` for legacy chat-completions style

## Design

- Tool schema is derived from:
  - `tool.name`
  - `tool.description`
  - `tool.inputSchema` (JSON Schema object)
- If a tool has no `inputSchema`, default to `{ type: "object", properties: {} }`.

## Task 1: Implement Responses tool schema generator

**Files:**
- Create: `packages/core/src/llm/tool-schemas.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/tool-schemas.test.ts`

**Step 1: Write failing test**

Test constructs a `ToolRegistry` with one tool:

- name: `Echo`
- description: `Echo input text`
- inputSchema includes `{ text: { type: "string" } }`

Expect output:

```json
[
  {
    "type": "function",
    "name": "Echo",
    "description": "Echo input text",
    "parameters": { "type": "object", "properties": { "text": { "type": "string" } }, "required": ["text"] }
  }
]
```

Run: `pnpm -C packages/core test`  
Expected: FAIL

**Step 2: Implement**

Implement `toolSchemasForOpenAIResponses({ registry, allowed })`.

**Step 3: Run tests**

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 4: Commit**

Commit message: `feat(core): add OpenAI tool schema generator`

