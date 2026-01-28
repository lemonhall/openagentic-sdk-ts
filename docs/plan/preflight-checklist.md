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

- `pwd` prints `.` at workspace root (and prints a workspace-relative path when `cwd` is set).
- `date` prints a timestamp (built-in, deterministic if `SOURCE_DATE_EPOCH` is set by tests).
- `rg -n hello .` works for workspace search (built-in wrapper today).
- `cat somefile.txt` prints file contents.
- `find . -maxdepth 2 -type f` returns some file paths (builtin).
- `printf "a\\nb\\n" | head -n 1` prints `a` (builtin).

If any of these are “unknown command” or print nothing, jump to “Known Failure Modes”.

## 3) Known failure modes (symptom → root cause → what to check)

### A) `date` / `rg` / `uname` / `whoami` says “unknown command”

Root causes we’ve hit:

1. Demo-web is running a stale `@openagentic/tools` build (or bundler cached an old module graph).
2. BashTool is delegating to WASI for commands that only exist as host builtins (current reality).

Checks:

- Ensure `packages/demo-web/vite.config.ts` still aliases tools source.
- Ensure BashTool forces these builtins in WASI mode (`packages/tools/src/bash/bash.ts`).

### A2) `pwd` prints a blank line

Root cause:

- Workspace-root `cwd` is represented as `""`, and `pwd` must render that as `.`.

Checks:

- Ensure demo-web is not running a stale `@openagentic/tools`.
- Ensure `pwd` builtin returns `.` when `io.cwd === ""` (`packages/tools/src/bash/builtins.ts`).

### B) `cat a.txt` runs but prints nothing

Root cause:

- The sample `core-utils` WASI `cat` applet currently echoes **stdin only** and does not open file paths.

Checks:

- Ensure BashTool is forcing the builtin `cat` (workspace-aware) instead of the WASI applet.

### B2) `find` / `head` says “unknown command”

Root cause:

- The WASI bundles may not ship these utilities; demo-web relies on `BashTool` builtins for them.

Checks:

- Ensure demo-web is not running a stale `@openagentic/tools`.
- Ensure BashTool forces the builtin (`packages/tools/src/bash/bash.ts`).

### C) Every prompt causes a burst of WASM network requests

Root cause:

- The UI is recreating the agent/bundle installer every prompt, so `installBundle()` refetches assets.

Checks:

- Demo-web should cache/reuse the created runtime/agent for the same config (`packages/demo-web/src/main.ts`).
- Demo-web should reuse a shared `BundleCache` and memoize install promises by bundle+version (`packages/demo-web/src/agent.ts`).
