# v9 Feature 04: Release + E2E Hardening (Implementation Plan)

> **Goal:** Reduce drift by making “default runnable paths” continuously tested and by tightening docs + configuration surfaces so breakage is caught early.

## Scope

- Add/strengthen “happy path” e2e tests:
  - Node: multi-turn tool loop that writes into shadow workspace and commits.
  - Browser: Playwright smoke + deterministic tool-calling flow (mock `/v1/responses`).
- Ensure docs guardrail tests assert the most important “how to run it” truths:
  - bundle base URL concept
  - server netFetch limitations + supported runner path
  - Python runtime status (real vs stub)
- Standardize environment/config naming across demos where possible (no hidden toggles).

## Acceptance

- At least one Node e2e and one browser e2e test run in CI (skip-gated only for platform-dependent prerequisites).
- Docs guardrail test asserts v9 docs exist and the “truth table” for netFetch is present.

## Files (expected)

- Modify/Create: `packages/demo-node/src/__tests__/*e2e*.test.ts`
- Modify/Create: `packages/demo-web/e2e/*` + `packages/demo-web/playwright.config.ts`
- Modify: `packages/core/src/__tests__/docs-guides.test.ts`
- Modify: `docs/guide/*`

