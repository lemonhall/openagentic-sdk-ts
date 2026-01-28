# v9 Feature 01: “Official Bundles” v1 (Layout, Serving, Mirror Story) (Implementation Plan)

> **Status:** ABANDONED as of v13 (2026-01-28). The “official bundles / distro” direction is abandoned; v13 pivots to a pinned toolchain + finite `Bash` contract.
> **Goal:** Make “official bundles” a first-class artifact with a stable on-disk layout, stable URLs, and clear trust/signature policy. Keep local dev easy; leave room for a future public mirror.

## Design options (pick one; v9 recommends Option A)

### Option A (recommended): Add `packages/bundles/official/` and serve it by default

- Introduce `packages/bundles/official/bundles/<name>/<version>/...`
- `demo-proxy` serves `/bundles/...` from `official` when present, otherwise falls back to `sample`.
- Demos default `wasiBundleBaseUrl` to proxy origin (already), so a new user gets bundles without local paths.

**Pros:** Clear semantics; easy migration; minimal disruption.  
**Cons:** Requires updating tests/docs and deciding what goes in official vs sample.

### Option B: Rename `sample/` → `official/` (hard break)

**Pros:** No duplication.  
**Cons:** Breaks paths and any external references; riskier churn.

### Option C: Keep only `sample/` but call it “official” in docs (not recommended)

**Pros:** No file churn.  
**Cons:** Confusing; not a real “official bundles” story.

## Scope

- Add `packages/bundles/official/` layout and at least `core-utils` as an official bundle.
- Update `demo-proxy` bundle serving to prefer `official` over `sample` when present (so new users don’t need local paths).
- Update docs to explain “bundles base url” and signature verification trust model.
- Add/extend tests that ensure `/bundles/...` serves signed manifests and assets.

## Acceptance

- `GET /bundles/core-utils/<version>/manifest.json` works in `demo-proxy`.
- Bundle install works in both `demo-node` and `demo-web` without pointing at local sample paths.
- Signature verification remains mandatory for “official” installs.

## Files (expected)

- Create: `packages/bundles/official/README.md`
- Create: `packages/bundles/official/bundles/core-utils/<version>/manifest.json`
- Create: `packages/bundles/official/bundles/core-utils/<version>/*.wasm`
- Modify: `packages/demo-proxy/src/server.ts`
- Modify: `docs/guide/quickstart-browser.md`
- Modify: `docs/guide/tools/bash.md`
- Test: `packages/demo-proxy/src/__tests__/bundles-route.test.ts`

## Steps (TDD)

1. Add/adjust the proxy route test to assert it serves from `official` when present.
2. Make the test fail (no `official` bundles yet).
3. Add `official/` layout + minimal `core-utils` bundle.
4. Update proxy serving to prefer `official`.
5. Run tests to green, then update docs.
