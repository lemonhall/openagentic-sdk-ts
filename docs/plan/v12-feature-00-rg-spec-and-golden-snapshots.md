# v12 Feature 00: `rg` Spec + Golden Snapshots (15.1.0)

## Goal

Define a stable, versioned contract for `rg` so we can test parity and prevent regressions.

## Scope

- Pin to ripgrep **15.1.0**.
- Add golden snapshots for:
  - `rg --version`
  - `rg --help`
  - `rg -h`
  - `rg --type-list`
- Record the upstream spec reference (the `rg(1)` man page + release tag) in the repo.

## Non-goals

- Implementing search behavior yet (this is only the contract + tests + wiring prerequisites).

## Acceptance

- A new spec folder exists under `docs/spec/rg/15.1.0/` with:
  - `SOURCES.md` explaining what we pinned to and how to update (bump version).
  - Golden text snapshots for the commands above.
- A new test validates the snapshots (and fails if output differs).

## Files

- Add:
  - `docs/spec/rg/15.1.0/SOURCES.md`
  - `docs/spec/rg/15.1.0/rg--version.txt`
  - `docs/spec/rg/15.1.0/rg--help.txt`
  - `docs/spec/rg/15.1.0/rg--h.txt`
  - `docs/spec/rg/15.1.0/rg--type-list.txt`
- Add tests (node): `packages/tools/src/__tests__/rg-parity.test.ts`

## Steps (TDD)

1. RED: write `rg-parity.test.ts` that asserts the output exactly matches the snapshot files.
2. RED proof: run `pnpm -C packages/tools test -- src/__tests__/rg-parity.test.ts` and see it fail.
3. GREEN: implement enough wiring so `rg --help` etc. can run under WASI-backed `CommandTool` (bundle can be stubbed for this feature).
4. GREEN proof: re-run the same command and see it pass.
5. REFACTOR: factor helpers for snapshot loading + command invocation.
6. Ship:
   - `git commit -m "v12: rg spec snapshots"`
   - `git push`

