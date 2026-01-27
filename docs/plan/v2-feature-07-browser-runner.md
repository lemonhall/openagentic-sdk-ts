# v2 Feature 07: Browser Runner Demo (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Add a runnable browser demo package (and a tiny local proxy) that proves the v2 stack works in the browser.

## Goal (user-visible)

Browser demo requirements:

- Runs as a local web app: `pnpm -C packages/demo-web dev`
- Uses OPFS as the shadow workspace (`OpfsWorkspace`)
- Supports multi-turn chat and streamed assistant output
- Supports tool calling (workspace file tools)
- Never sends cookies (`credentials: "omit"`)

## Design (important reality check: CORS)

Direct browser calls to `https://api.openai.com/v1/responses` are typically blocked by CORS and require exposing an API key to the page.

To keep the demo actually runnable, v2 browser demo uses:

- `packages/demo-proxy`: a local Node HTTP proxy that:
  - adds the OpenAI API key server-side (`OPENAI_API_KEY`)
  - forwards the request to OpenAI Responses API
  - streams the SSE response back to the browser
  - sets permissive CORS headers for localhost dev
- `packages/demo-web`: the browser UI and in-browser agent runtime
  - configures `OpenAIResponsesProvider({ baseUrl: "http://localhost:<port>/v1" })`

## Acceptance (hard)

- `pnpm test` passes
- Manual run works:
  - `OPENAI_API_KEY=... pnpm -C packages/demo-proxy start`
  - `pnpm -C packages/demo-web dev`
  - open the URL, chat, see streaming output
  - import a directory into OPFS shadow and commit back on explicit action

---

## Task 1: Scaffold the local proxy (`demo-proxy`)

**Files:**
- Create: `packages/demo-proxy/package.json`
- Create: `packages/demo-proxy/tsconfig.build.json`
- Create: `packages/demo-proxy/src/main.ts`
- Create: `packages/demo-proxy/src/server.ts`
- Test: `packages/demo-proxy/src/__tests__/proxy.test.ts`

**Step 1: Write a failing test**

- Start the server on an ephemeral port.
- Stub the upstream `fetch` via injection.
- Send `POST /v1/responses` and assert:
  - the proxy forwards method/body
  - the proxy adds `authorization: Bearer ...` server-side
  - the proxy returns streaming bytes to the client
  - CORS headers exist (`access-control-allow-origin`)

Run: `pnpm -C packages/demo-proxy test`  
Expected: FAIL

**Step 2: Minimal implementation**

- Implement `createProxyServer({ apiKey, fetchImpl })` returning `{ listen, close }`.
- Implement CORS preflight (`OPTIONS`) and proxying for `POST /v1/responses`.

Run: `pnpm -C packages/demo-proxy test`  
Expected: PASS

**Step 3: Manual**

Run: `OPENAI_API_KEY=... pnpm -C packages/demo-proxy start`  
Expected: prints `listening on http://localhost:...`

**Step 4: Commit**

Commit message: `feat(demo): add local OpenAI proxy for browser`

---

## Task 2: Scaffold the web demo (`demo-web`) with a testable core

**Files:**
- Create: `packages/demo-web/package.json`
- Create: `packages/demo-web/vite.config.ts`
- Create: `packages/demo-web/index.html`
- Create: `packages/demo-web/src/main.ts`
- Create: `packages/demo-web/src/styles.css`
- Create: `packages/demo-web/src/state.ts`
- Test: `packages/demo-web/src/__tests__/state.test.ts`

**Step 1: Write a failing state test**

- Model a tiny chat state reducer:
  - append user message
  - accumulate assistant deltas into a “streaming” message
  - finalize assistant message

Run: `pnpm -C packages/demo-web test`  
Expected: FAIL

**Step 2: Minimal implementation**

- Implement the reducer in `src/state.ts`.

Run: `pnpm -C packages/demo-web test`  
Expected: PASS

**Step 3: Add minimal UI (manual)**

- Basic ChatGPT-like layout:
  - transcript pane
  - prompt textarea + send button
  - controls row (proxy URL, choose directory, import, commit)

Run: `pnpm -C packages/demo-web dev`  
Expected: page loads and UI renders

**Step 4: Commit**

Commit message: `feat(demo): scaffold browser runner UI`

---

## Task 3: Wire the in-browser agent runtime to the proxy provider

**Files:**
- Modify: `packages/demo-web/src/main.ts`
- Create: `packages/demo-web/src/agent.ts`
- Test: `packages/demo-web/src/__tests__/agent-wire.test.ts`

**Step 1: Write a failing test**

- Use a `FakeProvider` in the browser demo code (no network).
- Assert:
  - `AgentRuntime.runTurn()` runs end-to-end
  - tool calls are executed and appended

Run: `pnpm -C packages/demo-web test`  
Expected: FAIL

**Step 2: Minimal implementation**

- Implement `createBrowserAgent({ providerBaseUrl })`:
  - `OpenAIResponsesProvider({ baseUrl: providerBaseUrl })`
  - `ToolRegistry` with workspace file tools
  - `ToolRunner` with an “allow all” gate for the demo
  - `JsonlSessionStore` backed by an in-memory backend (persistence deferred)

Run: `pnpm -C packages/demo-web test`  
Expected: PASS

**Step 3: Manual**

- From UI, send prompts; verify streaming output and tool call behavior.

**Step 4: Commit**

Commit message: `feat(demo): run browser agent via local proxy`

---

## Task 4: OPFS shadow workspace + import/commit via File System Access API

**Files:**
- Modify: `packages/demo-web/src/agent.ts`
- Create: `packages/demo-web/src/workspace.ts`

**Acceptance (manual):**
- “Choose directory” → “Import” copies into OPFS shadow
- Tool calls only see OPFS
- “Commit” writes OPFS contents back to the chosen directory

**Commit message:** `feat(demo): add OPFS shadow import/commit flow`
