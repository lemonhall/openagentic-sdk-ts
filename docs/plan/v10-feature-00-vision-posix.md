# v10 Feature 00: Vision Update — POSIX-ish `sh` as a First-Class Goal (Implementation Plan)

> **Goal:** Update the repo vision so “Bash” explicitly targets POSIX-ish `sh` semantics (within a documented subset) and the remaining gaps are tracked as v10 work.

## Scope

- Update `docs/plan/2026-01-27-vision-and-core-design.md`:
  - Add a POSIX-ish shell compatibility goal (subset + non-goals).
  - Update “Remaining gaps vs the original story” to include shell semantics + minimal toolchain gaps.
  - Add a “Next milestone (v10)” section linking to `docs/plan/v10-index.md`.
- Update `docs/plan/index.md` to link v10.
- Update docs guardrail tests so drift is caught early.

## Acceptance

- `packages/core` docs test asserts:
  - `docs/plan/index.md` links to `v10-index.md`
  - vision mentions POSIX-ish shell goal
- `pnpm -C packages/core test -- --run docs/guide` passes.

## Files

- Modify: `docs/plan/index.md`
- Create: `docs/plan/v10-index.md`
- Create: `docs/plan/v10-feature-00-vision-posix.md`
- Modify: `docs/plan/2026-01-27-vision-and-core-design.md`
- Modify: `packages/core/src/__tests__/docs-guides.test.ts`

## Steps (TDD; 1 commit)

1. Update doc guardrail test to expect v10 links + POSIX mention (red).
2. Update docs to green.
3. Commit + push:
   - `git add -A`
   - `git commit -m "docs(plan): add v10 POSIX-ish shell roadmap"`
   - `git push`

