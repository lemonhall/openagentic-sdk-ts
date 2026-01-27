# v8 Feature 05: Official Bundles Hosting (Local Proxy + Future Public Mirror) (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Make it easy to run the browser demo without a local “sample bundle” path by serving signed official bundles over HTTP from the existing local proxy.

**Architecture:**

- Extend `packages/demo-proxy` to serve bundle files from `packages/bundles/official/bundles/...`:
  - `GET /bundles/<name>/<version>/manifest.json`
  - `GET /bundles/<name>/<version>/<asset>`
- Keep signature verification mandatory (client-side). The proxy is just a static mirror.
- Update `demo-web` to default `wasiBundleBaseUrl` to the same origin as the proxy (without `/v1`).
- Leave room for a future public mirror (e.g., GitHub Pages) by keeping the base URL configurable.

**Tech Stack:** Node HTTP, TypeScript, Vitest.

### Task 1: Add bundle-serving routes to the demo proxy

**Files:**
- Modify: `packages/demo-proxy/src/server.ts`
- Test: `packages/demo-proxy/src/__tests__/bundles-route.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { createProxyServer } from "../server.js";

describe("demo-proxy bundles route", () => {
  it("serves an official manifest.json via GET /bundles/...", async () => {
    const s = createProxyServer({ apiKey: "x", fetchImpl: async () => new Response("", { status: 500 }) as any });
    await s.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${s.port}/bundles/core-utils/0.0.0/manifest.json`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain("\"signature\"");
    } finally {
      await s.close();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-proxy test -- --run bundles-route`  
Expected: FAIL (404).

**Step 3: Minimal implementation**

In `createProxyHandler`:

- Expand CORS to allow `GET` for `/bundles/*`
- Add a GET handler:
  - map the URL path to a file under repo root:
    - `packages/bundles/official/<urlPath>`
  - serve bytes:
    - `manifest.json` as `application/json`
    - `.wasm` as `application/wasm`
- Reject path traversal (`..`, backslashes)
- Return 404 when not found

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-proxy test -- --run bundles-route`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-proxy
git commit -m "feat(demo-proxy): serve official bundles over http"
git push
```

### Task 2: Make demo-web default to the proxy for bundles

**Files:**
- Modify: `packages/demo-web/src/main.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `docs/guide/quickstart-browser.md`

**Step 1: Write failing test for default bundle base URL behavior**

**Files:**
- Create: `packages/demo-web/src/__tests__/bundles-default.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { defaultBundleBaseUrlFromProxy } from "../url-defaults.js";

describe("bundle base url defaults", () => {
  it("derives bundle base url from proxy /v1 base url", () => {
    expect(defaultBundleBaseUrlFromProxy("http://localhost:8787/v1")).toBe("http://localhost:8787");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-web test -- --run bundles-default`  
Expected: FAIL.

**Step 3: Minimal implementation**

- Add `packages/demo-web/src/url-defaults.ts` implementing `defaultBundleBaseUrlFromProxy(...)`
- Update `createBrowserAgent(...)` call to pass `wasiBundleBaseUrl`:
  - default: derived from proxy base URL input (strip trailing `/v1`)
- (Optional UX) Add a separate “Bundles Base URL” field if derivation is confusing.

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-web test -- --run bundles-default`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-web docs/guide/quickstart-browser.md
git commit -m "feat(demo-web): default bundle base url from proxy"
git push
```

### Task 3: Document a future public “official bundles mirror”

**Files:**
- Modify: `docs/guide/quickstart-browser.md`
- Modify: `docs/guide/tools/bash.md`

**Step 1: Add a small doc assertion**

**Files:**
- Modify: `packages/core/src/__tests__/docs-guides.test.ts`

Assert that quickstart mentions “bundles base URL” and that signatures are verified.

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: FAIL.

**Step 3: Update docs**

- Explain local default (proxy serving `/bundles/...`)
- Explain how to point at a future official mirror URL
- Reiterate signature verification and “official key” trust model

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/guide packages/core/src/__tests__/docs-guides.test.ts
git commit -m "docs: explain official bundles hosting and defaults"
git push
```

