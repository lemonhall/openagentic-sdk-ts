# v8 Plans Index — Close Vision Gaps (Durability, Review UX, NetFetch, Python, E2E)

> Goal of v8: bring the repo back in sync with the original “vision story” by closing the most important remaining gaps that block **real-world use** (especially in the browser), while keeping the core SDK API stable.

## Why v8 exists

The original vision (`docs/plan/2026-01-27-vision-and-core-design.md`) is mostly implemented through v1–v7:

- runnable agent loop (Node + browser)
- tool-first runtime + permission gate
- shadow workspace + import/commit boundary (OPFS in browser)
- WASI-first `Bash` (`Shell(script)` compiled to `Command(argv)`)
- signed tool bundles + official registry enforcement
- pluggable outer sandboxes (Linux Bubblewrap + v7 cross-platform best-effort backends)

However, a few gaps still make the “story” feel incomplete or prototype-grade:

1. **Browser sessions aren’t durable**: the demo uses an in-memory JSONL backend, so reload loses history and audit logs.
2. **Review UX is minimal**: commit confirmation only shows counts, not a reviewable change list / previews.
3. **Server WASI netfetch is misleading**: the Node demo may pass `netFetch`, but the `wasmtime` CLI runner cannot accept custom host imports. This needs a clear contract + a practical path.
4. **Python-in-WASI is still a stub**: the current `lang-python` bundle is a placeholder.
5. **“Official bundles” aren’t actually hosted**: a new user should be able to run demos without pointing at local sample paths.
6. **E2E confidence is thin**: many tests are unit/contract-level; we need at least one “happy path” e2e slice per environment.

## v8 success criteria (hard)

1. Browser demo persists sessions across reloads (durable JSONL).
2. Browser demo shows a reviewable changeset (file list + preview/diff under limits) before commit.
3. Server-side `netFetch` support is explicitly correct:
   - `wasmtime` CLI runner rejects `netFetch` (no silent ignore).
   - demos/docs have a clear supported path (fallback runner or alternative).
4. `Python` tool either becomes “real” (WASI runtime bundle) or is explicitly scoped/disabled by default with a documented roadmap and test coverage.
5. Demos default to an official bundle base URL (override supported; only official is “blessed”).
6. Add at least one e2e test slice that exercises: multi-turn → tool call → tool result → continued model output.

## Plans (suggested execution order)

1. `v8-feature-00-vision-docs-truth-pass.md`
2. `v8-feature-01-browser-durable-sessions.md`
3. `v8-feature-02-browser-changeset-review-ui.md`
4. `v8-feature-03-server-wasi-netfetch-contract.md`
5. `v8-feature-04-python-wasi-runtime.md`
6. `v8-feature-05-official-bundles-hosting.md`
7. `v8-feature-06-e2e-happy-path-tests.md`

