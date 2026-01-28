# Preflight Checklist (Before Starting a vN Iteration)

This file is “long-term memory” for recurring gotchas that can otherwise burn hours during a new `docs/plan/vN-*` iteration.

## 0) Confirm you’re testing the code you just changed

### Demo-web (browser) uses the right `@openagentic/tools`

- If you changed `packages/tools/src/**`, ensure demo-web is using source (not stale `dist/`):
  - `packages/demo-web/vite.config.ts` aliases `@openagentic/tools` → `packages/tools/src/index.ts`.
- If you remove/modify that alias, you **must** rebuild tools (`pnpm -C packages/tools build`) before trusting demo-web behavior.

## 1) Smoke tests (fast, deterministic)

Run:

- `pnpm -C packages/tools test -- src/__tests__/bash-tool.test.ts`
- `pnpm -C packages/tools test -- src/__tests__/shell-compat.test.ts`

If these fail, do not trust manual demo testing.

## 2) Demo-web sanity checks (WASI Bash mode)

In the demo-web UI (with WASI Bash enabled), verify:

- `date` prints a timestamp (built-in, deterministic if `SOURCE_DATE_EPOCH` is set by tests).
- `rg -n hello .` works for workspace search (built-in wrapper today).
- `cat somefile.txt` prints file contents.

If any of these are “unknown command” or print nothing, jump to “Known Failure Modes”.

## 3) Known failure modes (symptom → root cause → what to check)

### A) `date` / `rg` / `uname` / `whoami` says “unknown command”

Root causes we’ve hit:

1. Demo-web is running a stale `@openagentic/tools` build (or bundler cached an old module graph).
2. BashTool is delegating to WASI for commands that only exist as host builtins (current reality).

Checks:

- Ensure `packages/demo-web/vite.config.ts` still aliases tools source.
- Ensure BashTool forces these builtins in WASI mode (`packages/tools/src/bash/bash.ts`).

### B) `cat a.txt` runs but prints nothing

Root cause:

- The sample `core-utils` WASI `cat` applet currently echoes **stdin only** and does not open file paths.

Checks:

- Ensure BashTool is forcing the builtin `cat` (workspace-aware) instead of the WASI applet.

### C) Every prompt causes a burst of WASM network requests

Root cause:

- The UI is recreating the agent/bundle installer every prompt, so `installBundle()` refetches assets.

Checks:

- Demo-web should cache/reuse the created runtime/agent for the same config (`packages/demo-web/src/main.ts`).
- Demo-web should reuse a shared `BundleCache` and memoize install promises by bundle+version (`packages/demo-web/src/agent.ts`).

