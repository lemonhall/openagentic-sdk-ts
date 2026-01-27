# v2 Feature 06: Node Runner Demo (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Provide a Node demo that proves the whole v2 stack runs end-to-end with a real LLM backend.

## Goal

Add a Node demo that:

- takes a local project directory path (read-only import to shadow workspace)
- runs an interactive multi-turn loop (stdin prompts)
- shows streamed assistant text
- persists sessions to disk (JSONL)
- optionally commits changes back to real FS only on explicit “commit”

## Task 1: Node session store backend (real package, not test-only)

**Files:**
- Create: `packages/node/src/index.ts`
- Create: `packages/node/src/session/node-backend.ts`
- Create: `packages/node/package.json`
- Test: `packages/node/src/__tests__/node-backend.test.ts`

**Acceptance:**
- Expose `createNodeJsonlBackend(rootDir)` implementing `JsonlBackend`.

**Commit message:** `feat(node): add session store backend`

## Task 2: Demo wiring

**Files:**
- Modify: `examples/node-runner/src/main.ts`
- Create: `examples/node-runner/src/repl.ts`

**Behavior:**
- Read `OPENAI_API_KEY` and fail fast if missing
- Instantiate:
  - `OpenAIResponsesProvider`
  - `AgentRuntime`
  - `ToolRegistry` including workspace tools + `Shell` (optional)
  - `ToolRunner` with permission mode “allow all” for the demo
  - `JsonlSessionStore` rooted at `.openagentic/sessions`
- On each user input:
  - call `runtime.runTurn(...)`
  - render streamed events

**Commit message:** `feat(v2): add node runner demo`

