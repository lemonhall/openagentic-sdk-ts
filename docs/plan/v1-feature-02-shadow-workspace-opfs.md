# v1-feature-02 — Shadow Workspace in OPFS

## Goal

Provide a shadow workspace that all tools operate on, backed by OPFS in browsers and a local directory on servers.

## Deliverables

- `Workspace` interface (read/write/list/stat, plus path normalization)
- Browser adapter: OPFS workspace root
- Server adapter: local directory workspace root
- Import from real folder handle → shadow workspace
- Change tracking + change set generation
- Commit: apply change set to the real folder handle (explicit user approval boundary)

## Files

Create/modify (suggested):

- `packages/workspace/src/index.ts`
- `packages/workspace/src/browser/opfs.ts`
- `packages/workspace/src/browser/import.ts`
- `packages/workspace/src/browser/commit.ts`
- `packages/workspace/src/changeset.ts`
- `packages/workspace/src/__tests__/changeset.test.ts`

## Steps (executable)

1. Red: change set generation tests
   - Given a base snapshot and current state, compute adds/deletes/modifies
2. Green: implement `changeset.ts`
3. Browser import/commit harness (integration-level)
   - Provide a minimal demo page or integration test harness (as feasible)

## Acceptance checks

- “Destructive” operations only affect shadow workspace.
- Commit requires explicit call and produces a reviewable change list.

