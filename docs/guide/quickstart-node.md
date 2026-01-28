# Quickstart (Node)

## Prerequisites

- Node.js 18+
- pnpm 10+
- An OpenAI API key in `OPENAI_API_KEY`
- Optional: `OPENAI_BASE_URL` for OpenAI-compatible providers (example: `https://your-provider.example/v1`)
- Optional: `TAVILY_API_KEY` to enable `WebSearch`

## Install

```bash
pnpm install
```

## Run

Run against a local project directory (the agent operates on a shadow workspace and only writes back on explicit commit):

```bash
OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project .
```

### `Bash` (Node/server)

The Node demo runs `Bash` using host-native `bash` under a sandbox backend when available, operating on the shadow workspace (not your real directory).

### OpenAI-compatible providers (custom base URL)

If your provider uses a non-OpenAI domain but is API-compatible, set `OPENAI_BASE_URL` (must include `/v1`):

```bash
OPENAI_API_KEY=... OPENAI_BASE_URL=https://your-provider.example/v1 pnpm -C packages/demo-node start -- --project .
```

### Server sandboxing (optional)

The Node demo can wrap tool execution in an additional process sandbox boundary (Linux/macOS/Windows support is best-effort and backend-dependent). See:

- `docs/guide/sandboxing.md`

### Commands

- Type any message to continue the conversation (multi-turn in a single session).
- `/status` shows how many files differ between the shadow workspace and real directory.
- `/commit` writes shadow changes back to the real directory.
- `/exit` quits.

## One-shot mode

```bash
OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project . --once "List the files in the workspace"
```
