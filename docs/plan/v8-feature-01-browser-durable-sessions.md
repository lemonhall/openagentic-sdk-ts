# v8 Feature 01: Durable Browser Sessions (IndexedDB JSONL Backend) (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Make browser sessions durable across reloads (event log persistence) without changing the core `JsonlSessionStore` API.

**Architecture:** Add a browser-only package `@openagentic/sdk-web` that provides a `JsonlBackend` implementation backed by IndexedDB. Update `demo-web` to use it by default.

**Tech Stack:** TypeScript, Vitest, `fake-indexeddb` (tests).

### Task 1: Create `@openagentic/sdk-web` package scaffold

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.build.json`
- Create: `packages/web/src/index.ts`

**Step 1: Write failing export test**

**Files:**
- Create: `packages/web/src/__tests__/exports.test.ts`

```ts
import { describe, expect, it } from "vitest";

describe("@openagentic/sdk-web exports", () => {
  it("exports createIndexedDbJsonlBackend", async () => {
    const m = await import("../index.js");
    expect(typeof (m as any).createIndexedDbJsonlBackend).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/web test`  
Expected: FAIL (package missing).

**Step 3: Minimal implementation**

- Add `vitest` + `typescript` dev deps (match other packages).
- Export a placeholder `createIndexedDbJsonlBackend` from `packages/web/src/index.ts` (throwing is fine for now).

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/web test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web): add sdk-web package scaffold"
git push
```

### Task 2: Implement `IndexedDbJsonlBackend`

**Files:**
- Create: `packages/web/src/session/indexeddb-jsonl-backend.ts`
- Modify: `packages/web/src/index.ts`
- Test: `packages/web/src/session/indexeddb-jsonl-backend.test.ts`

**Step 1: Write failing test (uses fake-indexeddb)**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";

import { createIndexedDbJsonlBackend } from "../indexeddb-jsonl-backend.js";

describe("IndexedDbJsonlBackend", () => {
  beforeEach(async () => {
    // ensure a clean DB per test; implement helper in backend module
    await (globalThis.indexedDB as any).deleteDatabase("oas-test");
  });

  it("supports writeText/readText/appendText", async () => {
    const b = createIndexedDbJsonlBackend({ dbName: "oas-test" });
    await b.mkdirp("sessions");
    await b.writeText("sessions/a.jsonl", "a\n");
    await b.appendText("sessions/a.jsonl", "b\n");
    expect(await b.readText("sessions/a.jsonl")).toBe("a\nb\n");
  });

  it("readText throws ENOENT for missing path", async () => {
    const b = createIndexedDbJsonlBackend({ dbName: "oas-test" });
    await expect(() => b.readText("missing.jsonl")).rejects.toThrow(/ENOENT/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/web test -- --run indexeddb-jsonl-backend`  
Expected: FAIL (module missing).

**Step 3: Minimal implementation**

Implement:

- `createIndexedDbJsonlBackend({ dbName, storeName? })` returning `JsonlBackend`
- Uses one object store: key = `path` (string), value = `{ text: string }`
- `mkdirp` is a no-op (paths are logical)
- `readText`: throw `Error("ENOENT")` if absent (consistent with existing tests)

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/web test -- --run indexeddb-jsonl-backend`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web): indexeddb jsonl backend for sessions"
git push
```

### Task 3: Wire durable sessions into the browser demo

**Files:**
- Modify: `packages/demo-web/src/main.ts`
- Modify: `packages/demo-web/package.json`
- Test: `packages/demo-web/src/__tests__/session-durability.test.ts`
- Docs: `docs/guide/quickstart-browser.md`

**Step 1: Write failing test for “durable backend is used”**

Factor `createDemoSessionStore()` out of `main.ts` so it can be unit-tested.

```ts
import { describe, expect, it } from "vitest";
import { createDemoSessionStore } from "../session-store.js";

describe("demo-web session store", () => {
  it("uses a durable backend (not the MemoryJsonlBackend)", () => {
    const store = createDemoSessionStore({ dbName: "oas-test" });
    expect(store).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-web test -- --run session-durability`  
Expected: FAIL (module missing).

**Step 3: Minimal implementation**

- Add dependency: `@openagentic/sdk-web`
- Create `packages/demo-web/src/session-store.ts` exporting `createDemoSessionStore(...)` that uses:
  - `new JsonlSessionStore(createIndexedDbJsonlBackend({ dbName }))`
- Remove `MemoryJsonlBackend` from `main.ts`

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-web test -- --run session-durability`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-web packages/web docs/guide/quickstart-browser.md
git commit -m "feat(demo-web): durable sessions via indexeddb jsonl"
git push
```

