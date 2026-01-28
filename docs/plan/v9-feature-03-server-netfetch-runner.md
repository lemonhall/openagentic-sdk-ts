# v9 Feature 03: Practical Server `netFetch` Runner Story (Implementation Plan)

> **Goal:** Provide a supported, testable server-side runner path for WASI `netFetch` workloads, with explicit tradeoffs vs the `wasmtime` CLI runner.

## Current truth (as of v8)

- Browser runner supports `netFetch` end-to-end with policy + audits.
- Server `wasmtime` CLI runner cannot support `netFetch` (no custom host imports); it must fail fast (already implemented).
- Server “in-process” runners can support `netFetch`, but change the isolation/performance envelope and need to be positioned explicitly.

## Design options (pick one; v9 recommends Option A)

### Option A (recommended): First-class “in-process” runner for server netFetch

- Provide a dedicated Node package (or clearly documented export) for an in-process WASI runner that supports `netFetch`.
- Make demo-node select it automatically when `enableWasiNetFetch=true` (already done) and add clear docs + tests.
- Explicitly document security/perf differences vs `wasmtime` CLI + outer sandboxes.

**Pros:** Shippable now; unblocks real netFetch workloads.  
**Cons:** Different hardening story; may require additional sandboxing guidance.

### Option B: Embed Wasmtime (native bindings) to support host imports

**Pros:** Fast + can support custom imports.  
**Cons:** Heavy deps, cross-platform complexity, CI pain.

### Option C: Component model + WASI HTTP (future)

**Pros:** Standardized interface for HTTP.  
**Cons:** Larger re-architecture; not v9-friendly.

## Scope

- Make the supported server `netFetch` runner path explicit in docs and code.
- Add an e2e-ish test slice that proves: tool calls `WebFetch` (or similar) → `netFetch` policy applies → result is returned.
- Ensure the selection surface is obvious and uniform across demos.

## Acceptance

- Docs include a truth table for server netFetch support and recommended configuration.
- A test exists that runs a deterministic netFetch flow (mocked network) through the server runner path.

## Files (expected)

- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/tools/web.md` (or relevant net tools doc)
- Test: `packages/demo-node/src/__tests__/*netfetch*.test.ts` (or similar)

