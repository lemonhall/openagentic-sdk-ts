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

