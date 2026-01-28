# v12 Feature 04: `rg` Performance + Scaling

## Goal

Make `rg` usable on real repos (10k+ files) without pathological slowdowns or repeated large downloads.

## Scope

- Ensure bundle install is:
  - cached in-memory within a session, and
  - cached durably in the browser (IndexedDB) across reloads.
- Ensure `CommandTool` avoids full workspace snapshots in the browser by using the mounted OPFS preopen directory.
- Add a guardrail benchmark test (very small) that fails if `rg` takes an absurd time on a synthetic workspace.

## Acceptance

- demo-web does not re-download the bundle assets for each prompt or each reload (once cached).
- `rg` run time on a medium synthetic workspace stays within a reasonable threshold on CI.

## Files

- Modify:
  - `packages/demo-web/src/agent.ts` (bundle caching policy)
  - `packages/tools/src/command.ts` (avoid unnecessary snapshotting where possible)
- Add:
  - `packages/tools/src/__tests__/rg-perf.test.ts` (time-bounded, conservative)

## Steps (TDD)

1. RED: add perf + caching tests that fail today.
2. GREEN: implement caching/memoization improvements.
3. Ship:
   - `git commit -m "v12: rg perf and caching guardrails"`
   - `git push`

