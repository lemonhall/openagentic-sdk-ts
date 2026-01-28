# Quickstart (Browser)

This demo runs the agent runtime in the browser, using OPFS as the shadow workspace. For OpenAI calls it uses a local proxy (to avoid CORS issues and keep API keys off the page).

## Prerequisites

- Node.js 18+
- pnpm 10+
- A Chromium-based browser (OPFS + File System Access API)
- An OpenAI API key in `OPENAI_API_KEY`

## Install

```bash
pnpm install
```

## Start the local proxy

```bash
OPENAI_API_KEY=... pnpm -C packages/demo-proxy start
```

Default: `http://localhost:8787/v1`

### OpenAI-compatible providers (custom upstream base URL)

If your provider is OpenAI-compatible but hosted elsewhere, set `OPENAI_BASE_URL` (must include `/v1`) for the proxy:

```bash
OPENAI_API_KEY=... OPENAI_BASE_URL=https://your-provider.example/v1 pnpm -C packages/demo-proxy start
```

## Start the web app

```bash
pnpm -C packages/demo-web dev
```

Open the URL printed by Vite.

## Import / Commit workflow

- Click “Choose Directory” to select a local folder (requires File System Access API).
- Click “Import → OPFS” to copy it into the OPFS shadow workspace.
- Run prompts in the chat; tools operate on OPFS, not your real folder.
- Click “Commit → Real” to write OPFS changes back to the selected folder.
- Sessions are stored as JSONL events in a durable browser store (reload-safe).

## WASI-backed `Bash` (preview)

In the web UI, enable “WASI Bash” to run the `Bash` tool via signed WASI bundles.

By default, the demo derives the **bundles base URL** from the proxy URL:

- Provider base URL: `http://localhost:8787/v1`
- Bundles base URL: `http://localhost:8787` (served under `/bundles/...`)

Bundle manifests are verified (signature + sha256) before use.

## WASI-backed `Python` (stub)

The web demo also includes an opt-in “WASI Python (stub)” toggle. This uses the `lang-python@0.0.0` demo bundle and is **not** full CPython/MicroPython semantics.

Note: `WebSearch` requires a server-side `TAVILY_API_KEY` and is not enabled in the browser demo by default.
