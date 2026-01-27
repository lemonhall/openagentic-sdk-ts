# v1-feature-12: Registry fetch defaults to credentials=omit

Goal: ensure bundle/registry downloads never use user cookies/session state by default (same safety rule as WASI netfetch).

## Scope

- `createRegistryClient()` default fetcher calls `fetch(url, { credentials: "omit" })`.
- Custom `fetcher` continues to be supported (power users can override).

## Files

- Modify: `packages/bundles/src/registry.ts`
- Add: `packages/bundles/src/__tests__/registry.test.ts`
- Modify: `docs/plan/index.md`

## TDD Tasks (Red → Green)

1) **RED** Add a test that stubs `globalThis.fetch` and asserts the `RequestInit.credentials` passed to it is `"omit"`.
2) Run: `pnpm -C packages/bundles test` (should fail because init is missing).
3) **GREEN** Update `createRegistryClient()` default fetcher to pass `{ credentials: "omit" }`.
4) Re-run: `pnpm -C packages/bundles test` and ensure pass.

## Verification

- `pnpm test`
- `git status` clean

