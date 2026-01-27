# OpenAgentic SDK (TypeScript)

Tool-first agent runtime for **TypeScript**, designed to run with consistent semantics in:

- Browsers (OPFS shadow workspace)
- WASM/WASI runtimes
- Servers (with a WASI host such as `wasmtime`)

This repo is a TS port of the Python `openagentic-sdk`, but focuses on the smallest set of building blocks needed to run an agent end-to-end:

- event-sourced sessions (JSONL)
- multi-turn chat
- tool calling
- sandboxed tool execution via a **shadow workspace**
- streaming (provider deltas)

## Status

- v1: core primitives (events, sessions, tools, workspace, WASI runner)
- v2: runnable demos + guides (Node + Browser)

## Quickstart (Node)

Prereqs: Node.js 18+, pnpm 10+, `OPENAI_API_KEY`

```bash
pnpm install
OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project .
```

CLI commands:

- `/status` shows the shadow-vs-real diff summary
- `/commit` writes shadow changes back to the real directory
- `/exit` quits

## Quickstart (Browser)

The browser demo runs the agent runtime in the browser and uses OPFS for the shadow workspace.
To avoid CORS issues and to keep API keys off the page, it calls OpenAI through a local proxy.

```bash
pnpm install
OPENAI_API_KEY=... pnpm -C packages/demo-proxy start
pnpm -C packages/demo-web dev
```

Open the Vite URL in a Chromium-based browser (File System Access API + OPFS required).

## Security Model (high level)

- **Shadow workspace isolation:** tools only see the shadow workspace; real files are only written on explicit commit.
- **No cookies:** all SDK network fetches use `credentials: "omit"` (no cookie leakage).
- **Browser API keys:** avoid putting long-lived API keys in browser code; the demo uses `packages/demo-proxy`.

More details: `docs/guide/security.md`

## Packages (workspace)

- `packages/core` (`@openagentic/sdk-core`): events, sessions, tool registry/runner, agent runtime, LLM provider types
- `packages/providers-openai` (`@openagentic/providers-openai`): OpenAI Responses API provider (JSON + SSE streaming)
- `packages/tools` (`@openagentic/tools`): tool implementations (workspace file tools; WASI Command/Shell exist but demos keep them off by default)
- `packages/workspace` (`@openagentic/workspace`): shadow workspace backends (Memory/OPFS) + import/commit helpers
- `packages/workspace/node` (`@openagentic/workspace/node`): Node-only workspace (LocalDirWorkspace)
- `packages/wasi-runner*`: WASI runners (web + wasmtime) and netfetch policy
- `packages/demo-node`: runnable Node demo (interactive)
- `packages/demo-proxy`: local OpenAI proxy for browser demo (CORS + key isolation)
- `packages/demo-web`: runnable browser demo (Vite)

## Docs

- User guides + quickstarts: `docs/guide/README.md`
- Project vision + core design: `docs/plan/2026-01-27-vision-and-core-design.md`
- v1/v2 plan index: `docs/plan/index.md`

## Development

```bash
pnpm test
pnpm build
pnpm typecheck
```

## 中文

See: `README.zh-CN.md`
