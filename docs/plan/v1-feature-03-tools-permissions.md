# v1-feature-03 — Tool Registry & Permission Gate

## Goal

Port the Python tool loop discipline: tools are first-class, permission-gated, and all tool I/O is recorded.

## Deliverables

- `Tool` interface + JSON schema exposure (for LLM tool calling)
- `ToolRegistry` (register/get/names)
- `PermissionGate` with default policy: ask once per session, then allow (resettable)
- Tool execution wrapper that emits events:
  - `tool.use` before running
  - `permission.question` / `permission.decision`
  - `tool.result` after running

## Files

Create/modify (suggested):

- `packages/core/src/tools/types.ts`
- `packages/core/src/tools/registry.ts`
- `packages/core/src/permissions/gate.ts`
- `packages/core/src/runtime/tool-runner.ts`
- `packages/core/src/__tests__/permission-gate.test.ts`
- `packages/core/src/__tests__/tool-runner.test.ts`

## Steps (TDD)

1. Red: permission gate “ask once, then allow” behavior
2. Green: implement gate
3. Red: tool runner emits correct event sequence
4. Green: implement tool runner

## Acceptance checks

- A tool call cannot run without permission decision.
- All tool uses are captured as events.

