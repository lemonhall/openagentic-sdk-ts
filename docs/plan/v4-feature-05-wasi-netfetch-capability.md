# v4 Feature 05: WASI `fetch` Capability Wiring + Policy + Auditing (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Allow WASI modules to perform network requests via host-injected `fetch`, with strict limits and event auditing, and with `credentials: "omit"` in browser.

## Problem / Current State

- The repo has “netfetch capability” types/utilities, but WASI runners/tools do not expose it end-to-end.
- `WebFetch` tool exists for TS-native tools, but WASI tools need the capability too.

## Deliverables

- A stable WASI hostcall surface for `fetch` (preview1-compatible import namespace).
- Policy enforcement:
  - timeout
  - max response bytes
  - allowlist/denylist hooks (simple API first)
- Audit events emitted for each fetch call (sanitized headers + sizes + timing).

## Tasks

### Task 1: Define runner-level `netFetch` interface and default policy

**Files:**
- Modify: `packages/wasi-runner/src/netfetch.ts` (or add if missing)
- Test: `packages/wasi-runner/src/__tests__/netfetch-policy.test.ts`

### Task 2: Implement hostcalls in runners

**Files:**
- Modify: `packages/wasi-runner-wasmtime/src/index.ts`
- Modify: `packages/wasi-runner-web/src/*` (both in-process and worker runner)
- Test: runner-specific tests that stub `fetch`

**Implementation note (v4 actual):**
- WASI preview1 imports are synchronous. In the browser, this is implemented via a **sync XHR** hostcall under an explicit namespace: `openagentic_netfetch.fetch_get(...)`.
- The web runner records per-call audits into `WasiExecResult.netFetchAudits` (structured-cloneable), so `WorkerWasiRunner` can return them to the main thread.
- Server `wasmtime` CLI runner cannot currently provide custom imports. The WASI netfetch hostcall is therefore **web-runner only** until the server runner moves to an embeddable runtime (or a standard WASI HTTP interface is adopted).

### Task 3: ToolRunner auditing events

**Files:**
- Modify: `packages/core/src/events/*` (add `net.fetch` event or equivalent)
- Modify: `packages/tools/src/command.ts` (emit events via context hook)
- Docs: `docs/guide/security.md`

**Commit:** `feat(wasi): netfetch capability with policy + audit`
