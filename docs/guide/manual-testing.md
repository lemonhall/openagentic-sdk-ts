# Manual Testing Checklist

## Node demo

```bash
pnpm install
OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project .
```

Try prompts that trigger tools:

- “List the files in the workspace.”
- “Create `notes.txt` containing ‘hello’.”
- “Show me the content of `notes.txt`.”
- “What changed? (then run `/status`)”
- “Commit the changes (then run `/commit`).”

## Browser demo

```bash
OPENAI_API_KEY=... pnpm -C packages/demo-proxy start
pnpm -C packages/demo-web dev
```

Then:

- Choose a directory
- Import → OPFS
- Ask the agent to create/edit files
- Commit → Real

