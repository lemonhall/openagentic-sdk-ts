# v9 Feature 00: Vision + Docs “Truth Pass” (as of v8) (Implementation Plan)

> **Goal:** Ensure the repo’s “story” (vision + plan index + guides) matches actual behavior as of v8, and that doc tests lock this in.

## Scope

- Update `docs/plan/2026-01-27-vision-and-core-design.md` to “Status (as of v8…)”.
- Update “Remaining gaps” to reflect what is *still* prototype-grade after v8.
- Ensure `docs/plan/index.md` links to `v9-index.md`.
- Update the existing docs guardrail test in `packages/core` to match the new truth.

## Acceptance

- `docs/plan/index.md` contains “v9 index” and links to `v9-index.md`.
- `docs/plan/2026-01-27-vision-and-core-design.md` contains “Status (as of v8”.
- The “Remaining gaps” section no longer claims browser sessions are in-memory or that review UX is minimal.
- `pnpm -C packages/core test -- --run docs/guide` passes.

## Files

- Modify: `docs/plan/index.md`
- Create: `docs/plan/v9-index.md`
- Create: `docs/plan/v9-feature-00-vision-docs-truth-pass.md`
- Modify: `docs/plan/2026-01-27-vision-and-core-design.md`
- Modify: `packages/core/src/__tests__/docs-guides.test.ts`

## Steps (TDD)

1. Update the docs guardrail test to assert v9 is discoverable and vision status is v8.
2. Run: `pnpm -C packages/core test -- --run docs/guide` (should fail until docs are updated).
3. Update the plan index + vision doc to reflect v8 reality and v9 scope.
4. Run the same test to green.
5. Refactor docs wording for brevity/precision (still green).

