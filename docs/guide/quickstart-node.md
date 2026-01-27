# Quickstart (Node)

## Prerequisites

- Node.js 18+
- pnpm 10+
- An OpenAI API key in `OPENAI_API_KEY`

## Install

```bash
pnpm install
```

## Run

Run against a local project directory (the agent operates on a shadow workspace and only writes back on explicit commit):

```bash
OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project .
```

### Commands

- Type any message to continue the conversation (multi-turn in a single session).
- `/status` shows how many files differ between the shadow workspace and real directory.
- `/commit` writes shadow changes back to the real directory.
- `/exit` quits.

## One-shot mode

```bash
OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project . --once "List the files in the workspace"
```

