# v8 Feature 02: Browser “Reviewable Changeset” UI (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Before committing to the real directory, show a reviewable changeset (adds/modifies/deletes) with safe previews under limits.

**Architecture:** Keep the core commit boundary in `@openagentic/workspace` unchanged. Improve only `demo-web` UI/UX:

- Compute a `ChangeSet` by comparing `snapshotWorkspace(workspace)` vs the *real folder snapshot* (computed lazily).
- Render changes (A/M/D) as a list; allow selecting an entry.
- Preview:
  - **After**: read from OPFS shadow workspace.
  - **Before**: read from the real directory handle (for M/D) on demand.
  - Text-only, size-limited (avoid freezing the UI).

**Tech Stack:** TypeScript, Vitest (unit tests for pure functions).

### Task 1: Add a pure “changeset model” module

**Files:**
- Create: `packages/demo-web/src/changeset-model.ts`
- Test: `packages/demo-web/src/__tests__/changeset-model.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { summarizeChangeSet } from "../changeset-model.js";

describe("summarizeChangeSet", () => {
  it("computes stable counts and a sorted list", () => {
    const s = summarizeChangeSet({
      adds: [{ kind: "add", path: "b.txt", after: { path: "b.txt", sha256: "2", size: 1 } }],
      deletes: [{ kind: "delete", path: "a.txt", before: { path: "a.txt", sha256: "1", size: 1 } }],
      modifies: [],
    } as any);
    expect(s.counts).toEqual({ add: 1, modify: 0, delete: 1 });
    expect(s.items.map((i) => i.path)).toEqual(["a.txt", "b.txt"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-web test -- --run changeset-model`  
Expected: FAIL (module missing).

**Step 3: Minimal implementation**

Implement `summarizeChangeSet(changeSet)` returning:

- `counts: { add, modify, delete }`
- `items: Array<{ kind: "add"|"modify"|"delete"; path: string }>` sorted by `path`

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-web test -- --run changeset-model`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-web/src/changeset-model.ts packages/demo-web/src/__tests__/changeset-model.test.ts
git commit -m "feat(demo-web): changeset model helpers"
git push
```

### Task 2: Implement safe preview helpers (text-only, size-limited)

**Files:**
- Create: `packages/demo-web/src/changeset-preview.ts`
- Test: `packages/demo-web/src/__tests__/changeset-preview.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { decodeTextPreview } from "../changeset-preview.js";

describe("decodeTextPreview", () => {
  it("returns null for binary-ish bytes", () => {
    const bytes = new Uint8Array([0, 255, 0, 255]);
    expect(decodeTextPreview(bytes)).toBeNull();
  });

  it("decodes utf8 and truncates", () => {
    const bytes = new TextEncoder().encode("hello");
    const p = decodeTextPreview(bytes, { maxChars: 3 });
    expect(p?.text).toBe("hel");
    expect(p?.truncated).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-web test -- --run changeset-preview`  
Expected: FAIL.

**Step 3: Minimal implementation**

Implement:

- `decodeTextPreview(bytes, { maxChars=20000 }) -> { text, truncated } | null`
- Heuristic: if contains NUL or a high ratio of non-printables, return `null`

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-web test -- --run changeset-preview`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-web/src/changeset-preview.ts packages/demo-web/src/__tests__/changeset-preview.test.ts
git commit -m "feat(demo-web): safe text preview helpers"
git push
```

### Task 3: Render a changeset panel in the UI and require explicit review before commit

**Files:**
- Modify: `packages/demo-web/src/main.ts`
- Create: `packages/demo-web/src/changeset-ui.ts` (DOM rendering helpers)
- Modify: `packages/demo-web/src/styles.css`

**Step 1: Write a failing UI unit test (DOM-only)**

If `demo-web` tests run in a DOM-less environment, first add a tiny helper that renders to a `DocumentFragment` and test it in Vitest’s default environment.

**Files:**
- Create: `packages/demo-web/src/__tests__/changeset-ui.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { renderChangeSetSummary } from "../changeset-ui.js";

describe("renderChangeSetSummary", () => {
  it("renders counts", () => {
    const el = renderChangeSetSummary({ add: 1, modify: 2, delete: 3 });
    expect(el.textContent).toContain("+1");
    expect(el.textContent).toContain("~2");
    expect(el.textContent).toContain("-3");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-web test -- --run changeset-ui`  
Expected: FAIL.

**Step 3: Minimal implementation**

- Add a “Changes” section in the sidebar:
  - summary counts
  - list of change items
  - click item → preview panel / modal
- Update “Commit → Real” flow:
  1. Compute changeset vs real dir handle (reuse existing `commitToDirectoryHandle` only for apply).
  2. Show the list + previews.
  3. Require a final “Apply commit” click.

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-web test -- --run changeset-ui`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-web
git commit -m "feat(demo-web): reviewable changeset UI before commit"
git push
```

