# v8 Feature 03: Server WASI `netFetch` Contract (No Silent Ignore) (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Make server-side WASI networking behavior explicitly correct: if a runner cannot provide `netFetch`, it must fail fast (not silently ignore).

**Architecture:**

- `@openagentic/wasi-runner-wasmtime` (CLI runner) **cannot** inject custom imports like `openagentic_netfetch`.
  - Therefore it must reject `WasiExecInput.netFetch` up-front.
- Demos and guides must treat “WASI Bash” and “WASI netFetch” as separate toggles:
  - Bash can work without networking.
  - netFetch is optional and runner-dependent on server.
- Provide a practical “supported path” on server:
  - Use `InProcessWasiRunner` (JS) when `netFetch` is enabled, or
  - Disable `netFetch` when using `wasmtime` CLI runner.

**Tech Stack:** TypeScript, Vitest.

### Task 1: Add a failing unit test for `WasmtimeWasiRunner` netFetch behavior

**Files:**
- Modify: `packages/wasi-runner-wasmtime/src/index.ts`
- Test: `packages/wasi-runner-wasmtime/src/__tests__/netfetch-unsupported.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { WasmtimeWasiRunner } from "../index.js";

describe("WasmtimeWasiRunner netFetch", () => {
  it("fails fast when netFetch is provided", async () => {
    const r = new WasmtimeWasiRunner("wasmtime");
    await expect(
      r.execModule({
        module: { kind: "bytes", bytes: new Uint8Array() },
        argv: [],
        netFetch: { policy: {} } as any,
      } as any),
    ).rejects.toThrow(/netFetch.*not supported/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/wasi-runner-wasmtime test -- --run netfetch-unsupported`  
Expected: FAIL (runner currently ignores `netFetch`).

**Step 3: Minimal implementation**

In `WasmtimeWasiRunner.execModule(...)`, add:

- `if (input.netFetch) throw new Error("WasmtimeWasiRunner: netFetch is not supported (wasmtime CLI runner)");`

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/wasi-runner-wasmtime test -- --run netfetch-unsupported`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/wasi-runner-wasmtime
git commit -m "fix(wasmtime): reject netFetch (unsupported via CLI)"
git push
```

### Task 2: Split “WASI Bash” vs “WASI netFetch” toggles in demos

**Files:**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/main.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `docs/guide/tools/web.md`
- Modify: `docs/guide/sandboxing.md`

**Step 1: Write failing demo-node test for selection logic**

**Files:**
- Modify: `packages/demo-node/src/__tests__/runtime-wire.test.ts`

Add a test that asserts:

- when `enableWasiNetFetch=true`, demo-node chooses `InProcessWasiRunner` even if `wasmtime` exists
- when `enableWasiNetFetch=false`, demo-node may choose `WasmtimeWasiRunner`

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-node test -- --run runtime-wire`  
Expected: FAIL.

**Step 3: Minimal implementation**

- Introduce `enableWasiNetFetch?: boolean` in both demos (default: `false`)
- Only set `contextFactory().netFetch` when `enableWasiNetFetch===true`
- In Node demo runner selection:
  - If `enableWasiNetFetch===true`: use `InProcessWasiRunner`
  - Else: keep current logic (prefer `wasmtime` when present)
- In browser demo UI: add a checkbox “WASI netFetch” (off by default)

**Step 4: Run tests to verify they pass**

Run:

- `pnpm -C packages/demo-node test -- --run runtime-wire`
- `pnpm -C packages/demo-web test`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-node packages/demo-web docs/guide
git commit -m "feat(demos): separate wasi bash vs netfetch toggles"
git push
```

### Task 3: Document the server netFetch truth table

**Files:**
- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/sandboxing.zh-CN.md`

**Step 1: Add a short doc test**

**Files:**
- Modify: `packages/core/src/__tests__/docs-guides.test.ts`

Add an assertion that `docs/guide/sandboxing.md` mentions that `wasmtime` CLI runner can’t support `netFetch`.

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: FAIL.

**Step 3: Update docs**

Add a “WASI netFetch support” section:

- Browser runner: supported
- Node in-process runner: supported
- Wasmtime CLI runner: not supported (requires embedded runtime / component model)

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/guide packages/core/src/__tests__/docs-guides.test.ts
git commit -m "docs: clarify server wasi netfetch support"
git push
```

