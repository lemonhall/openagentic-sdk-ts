# v6 Feature 03: demo-node Engine Switch (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Allow the Node demo to choose tool execution engine: `wasi` (portable) vs `native` (host tools under Bubblewrap).

**Architecture:** Extend demo-node runtime wiring to select one `Bash` tool implementation:

- `engine=wasi`: existing WASI-first path
- `engine=native`: register `NativeBashTool` using `BubblewrapNativeRunner` (Linux-only)

**Tech Stack:** TypeScript, Vitest.

### Task 1: Add engine flag parsing

**Files:**
- Modify: `packages/demo-node/src/runtime.ts`
- Test: `packages/demo-node/src/__tests__/runtime-wire.test.ts`

**Step 1: Write failing test**

Add a test that sets `process.env.OPENAGENTIC_TOOL_ENGINE="native"` and expects the runtime to register a `Bash` tool (native) without installing any WASI bundles.

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-node test`  
Expected: FAIL until wiring exists.

**Step 3: Implement minimal wiring**

- If `OPENAGENTIC_TOOL_ENGINE === "native"`:
  - create `BubblewrapNativeRunner` (if Linux + bwrap available; otherwise warn or throw when required)
  - register `NativeBashTool` as `Bash`
  - do not install bundles
- Else default `wasi` (current behavior).

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-node test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-node
git commit -m "feat(demo-node): engine switch (native/wasi)"
git push
```

