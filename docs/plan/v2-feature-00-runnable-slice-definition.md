# v2 Feature 00: Runnable Slice Definition (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Define “runnable” acceptance criteria and the minimal module boundaries for v2.

## Goal

By the end of v2, a developer can:

- Run a Node demo that:
  - connects to a real LLM backend (OpenAI Responses API)
  - supports multi-turn sessions (same `sessionId`)
  - supports tool calling (LLM requests a tool, tool runs, LLM continues)
  - streams assistant text deltas as events
  - stores the full event log in a JSONL session store
- Run a Browser demo that:
  - does the same via `fetch` (no cookies; `credentials: "omit"`)
  - uses OPFS as the shadow workspace

## Architecture (v2 minimal)

- `@openagentic/sdk-core`
  - Provider types + stream event types
  - Tool schema generation (OpenAI Responses)
  - `AgentRuntime` loop (session store + provider + tool runner)
- `@openagentic/providers-openai` (new)
  - OpenAI Responses provider (`complete()` + `stream()`)
- `@openagentic/tools`
  - Extend with “workspace file tools” (non-WASI) so the agent can operate without requiring a large WASI tool bundle to exist on day one
- `examples/node-runner` (new workspace package) OR `packages/node-runner` (new internal package)
  - proves end-to-end on Node
- `examples/browser-runner` (new)
  - proves end-to-end on browser + OPFS

## Success criteria (hard)

- `pnpm test` passes
- Node demo can run with:
  - `OPENAI_API_KEY=... pnpm -C examples/node-runner start`
- Browser demo can run with:
  - `pnpm -C examples/browser-runner dev`

## Task 1: Add v2 demo skeletons (no LLM yet)

**Files:**
- Create: `examples/node-runner/package.json`
- Create: `examples/node-runner/src/main.ts`
- Create: `examples/browser-runner/package.json`
- Create: `examples/browser-runner/src/main.ts`
- Modify: `pnpm-workspace.yaml`

**Step 1: Add “smoke” tests that demos compile**

Create a build-only test (or TypeScript compile step) per demo.

Run: `pnpm -r build`  
Expected: succeeds (demos compile; no runtime behavior required yet)

**Step 2: Commit**

Commit message: `feat(v2): add demo skeletons`

## Task 2: Define the v2 public surface

**Files:**
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/llm/index.ts`
- Create: `packages/core/src/runtime/agent-runtime.ts`
- Create: `packages/core/src/runtime/options.ts`

**Acceptance:**
- `@openagentic/sdk-core` exports:
  - `AgentRuntime`
  - provider types (`ModelProvider`, `ModelOutput`, stream events)
  - tool-schema helpers (`toolSchemasForOpenAIResponses`)

**Step 1: Add a minimal compile-time test**

Add `packages/core/src/__tests__/public-api-v2.test.ts` that imports the new exports and asserts types exist (runtime assertion can be trivial).

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 2: Commit**

Commit message: `feat(core): define v2 public API`

