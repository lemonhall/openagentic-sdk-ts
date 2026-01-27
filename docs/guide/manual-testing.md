# Manual Testing Checklist

## Node demo

```bash
pnpm install
OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project . [--wasi]
```

Try prompts that trigger tools:

- “List the files in the workspace.”
- “Find all TypeScript files (Glob).”
- “Search for `TODO` across files (Grep).”
- “Create `notes.txt` containing ‘hello’.”
- “Show me the content of `notes.txt`.”
- “Replace ‘hello’ with ‘hi’ in `notes.txt` (Edit).”
- “Run `echo hi > out.txt` (Bash).”
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
