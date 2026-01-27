# v1-feature-01 — Events & Sessions

## Goal

Implement a portable event model and session store compatible with event-sourced replay.

## Deliverables

- Event type definitions (JSON-serializable)
- Session store interface:
  - append event
  - read events
  - create session id
  - metadata record
- JSONL storage adapter for Node and browser (browser stored in OPFS via workspace storage layer)

## Files

Create/modify (suggested):

- `packages/core/src/events.ts`
- `packages/core/src/session/store.ts`
- `packages/core/src/session/jsonl.ts`
- `packages/core/src/__tests__/session-jsonl.test.ts`

## Steps (TDD oriented)

1. Red: write tests for append/read ordering and stable `session_id`
   - Command: `pnpm vitest -t session-jsonl`
   - Expected: failures (store not implemented)
2. Green: implement minimal JSONL store
   - Expected: tests pass
3. Add replay helpers for “provider input rebuild”
   - Expected: deterministic reconstruction for a small scripted event list

## Acceptance checks

- Can create a session, append `system.init`, append tool events, read them back in order.
- Output is valid JSONL and forward compatible (unknown fields ignored).

