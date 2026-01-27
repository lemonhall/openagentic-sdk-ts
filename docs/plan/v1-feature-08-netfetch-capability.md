# v1-feature-08 — WASI `fetch` Capability (network)

## Goal

Allow WASI tools to access the network through a host-injected `fetch` capability, audited and limited.

## Defaults (v1)

- Allow all destinations
- Strict limits: timeout, max response bytes, concurrency, total request count/bytes
- Browser: `credentials: "omit"` (never use user cookies/session)
- Sanitized headers in logs (avoid leaking secrets)

## Deliverables

- `NetFetch` interface exposed to WASI runner
- Event schema for requests/responses (sanitized)
- Policy knobs (limits, allowlist optional, future)

## Files

Create/modify (suggested):

- `packages/wasi-runner/src/netfetch.ts`
- `packages/wasi-runner-web/src/netfetch.ts`
- `packages/wasi-runner-wasmtime/src/netfetch.ts`
- `packages/wasi-runner/src/__tests__/netfetch-policy.test.ts`

## Steps (TDD)

1. Red: policy tests for limits and `credentials: omit`
2. Green: implement web and server adapters
3. Add event emission for auditing

## Acceptance checks

- A WASI command can fetch a URL and receive response text within limits.
- No cookie/credential leakage in browser mode.

