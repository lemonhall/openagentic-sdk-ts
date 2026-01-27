# v6 Feature 05: Native Engine Performance Optimizations (Follow-up Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Reduce the overhead of Bubblewrap-native execution when the agent emits many small shell commands, without weakening isolation or auditability.

**Architecture:** Start with the simplest, highest-leverage improvements first (prompt/tooling-level batching), then add optional runtime enhancements (session reuse) if needed.

**Tech Stack:** Node `child_process.spawn`, Vitest, (optional) PTY libraries for Node.

## Non-goals

- Perfect cross-platform parity (this is Linux-only native engine territory).
- Replacing the WASI toolchain as the default; this is a “deployment choice” engine.

## Tasks

### Task 1: Add a “batching hint” utility for prompts (low effort, high leverage)

**Files:**
- Create: `packages/tools/src/bash/batching-hints.ts`
- Modify: `packages/tools/src/bash/bash-native.ts` (optional: include `description` hint)
- Test: `packages/tools/src/__tests__/bash-batching-hints.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { defaultBashBatchingHint } from "../bash/batching-hints.js";

describe("defaultBashBatchingHint", () => {
  it("mentions batching to reduce process spawns", () => {
    expect(defaultBashBatchingHint()).toContain("batch");
    expect(defaultBashBatchingHint()).toContain("bash -lc");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/tools test`  
Expected: FAIL (module missing).

**Step 3: Minimal implementation**

Return a short text snippet that product code can inject into system prompts/tool descriptions.

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/tools test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/tools
git commit -m "feat(tools): bash batching hint"
git push
```

### Task 2: Add optional “script concatenation” mode to NativeBashTool (no extra processes)

**Files:**
- Modify: `packages/tools/src/bash/bash-native.ts`
- Test: `packages/tools/src/__tests__/bash-native-batching.test.ts`

Idea:

- Provide a helper API (not exposed to LLM directly) that takes `string[]` commands and runs them as:
  - `bash -lc "set -euo pipefail; cmd1; cmd2; cmd3"`

This enables SDK users (or higher-level agents) to batch work without modifying the LLM prompt strategy.

### Task 3 (optional): Long-lived bash session (significant complexity)

**Problem:** If the agent still emits many tiny commands, per-call process startup dominates.

**Approach options:**

1. **Keep a single bash process alive** per session and communicate via stdin/stdout delimiters.
   - Pros: big speedup for tiny commands.
   - Cons: harder timeouts, harder isolation resets, careful delimiter framing needed, and still needs Bubblewrap boundary.

2. **PTY-backed session** (more compatible with interactive commands).
   - Pros: better compatibility (programs expecting a TTY).
   - Cons: additional dependencies, more edge cases.

**Files (tentative):**
- Create: `packages/native-runner/src/session.ts`
- Create: `packages/native-runner/src/__tests__/session.integration.test.ts`

**Acceptance:**
- Config-gated; default remains “one process per call”.
- Hard timeout + kill works reliably.
- Audit captures per-command boundaries within the session.

### Task 4: Metrics + regression guardrails

**Files:**
- Create: `packages/native-runner/src/metrics.ts`
- Test: `packages/native-runner/src/__tests__/metrics.test.ts`

Collect:

- process spawn count
- total wall time spent in spawn vs execution
- output truncation rate

Expose via events for operator visibility.

