# v11 Feature 00: POSIX Gap Audit (Reality vs Claims) (Implementation Plan)

> **Goal:** Make the repo’s “POSIX-ish `sh`” claim measurable: enumerate what we support, what we do not, and which gaps block real scripts most often.

## Scope

- Write a concise “Supported subset” and “Non-goals (for now)” section for the shell.
- Convert the most important semantic gaps into v11 feature slices with acceptance tests.

## Acceptance

- `docs/plan/v11-index.md` contains:
  - an explicit list of “implemented vs missing” POSIX areas
  - prioritized slices for v11 with success criteria
- The compat suite includes at least one fixture that would fail without field splitting and passes with it (added later in v11).

## Files

- Modify: `docs/plan/v11-index.md`
- Add fixtures gradually under: `packages/tools/src/__tests__/shell-compat/`

## Steps (1 commit)

1. Update `v11-index.md` with any new gaps discovered during implementation.
2. Commit + push:
   - `git add -A`
   - `git commit -m "docs(plan): start v11 POSIX gap audit"`
   - `git push`

