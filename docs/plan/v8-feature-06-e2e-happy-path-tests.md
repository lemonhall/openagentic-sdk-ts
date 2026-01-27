# v8 Feature 06: E2E “Happy Path” Tests (Node + Browser) (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Add at least one end-to-end slice per environment that exercises the full loop: model output → tool call → tool execution → tool result → continued model output.

**Architecture:**

- Node: extend existing “CLI + fake provider” tests to cover a WASI-backed tool call (and optionally sandbox audit presence).
- Browser: add Playwright tests that load `demo-web` and intercept `/v1/responses` to return a deterministic tool-calling response stream.

**Tech Stack:** Vitest, Playwright (browser e2e).

### Task 1: Node e2e test for WASI `Bash` (or `Command`) tool path

**Files:**
- Create: `packages/demo-node/src/__tests__/cli-wasi-bash.e2e.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../index.js";

class ToolCallingProvider {
  calls = 0;
  async complete() {
    this.calls += 1;
    if (this.calls === 1) {
      return {
        assistantText: null,
        toolCalls: [{ toolUseId: "b1", name: "Bash", input: { argv: ["bash", "-lc", "echo hi > hi.txt"] } }],
      };
    }
    return { assistantText: "done", toolCalls: [] };
  }
}

describe("demo-node CLI (wasi bash e2e)", () => {
  it("runs a wasi-backed bash command that modifies the shadow workspace and commits", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "oas-node-e2e-"));
    await writeFile(join(projectDir, "seed.txt"), "seed\n");

    const res = await runCli(["--project", projectDir], {
      provider: new ToolCallingProvider() as any,
      model: "fake-model",
      // Ensure the wasi engine is selected.
      env: { OPENAGENTIC_TOOL_ENGINE: "wasi" },
      lines: ["do it", "/commit", "/exit"],
    } as any);

    expect(res.exitCode).toBe(0);
    expect(await readFile(join(projectDir, "hi.txt"), "utf8")).toContain("hi");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-node test -- --run wasi-bash.e2e`  
Expected: FAIL until the test uses the correct `Bash` tool input schema (confirm whether it’s `argv` or `script`), and until bundle hosting is available for the runner used in tests.

**Step 3: Minimal implementation**

- Use the correct `Bash` tool schema:
  - If `Bash` expects `{ script }`, switch to `script: "echo hi > hi.txt"`
  - If it expects `{ argv }`, keep as is
- Ensure the demo runtime used by CLI has WASI bash enabled and can install bundles in the test environment:
  - either via local official bundles path (recommended), or
  - via the proxy bundle server (v8-feature-05)

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-node test -- --run wasi-bash.e2e`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-node/src/__tests__/cli-wasi-bash.e2e.test.ts
git commit -m "test(demo-node): e2e wasi bash tool loop"
git push
```

### Task 2: Add Playwright to `demo-web`

**Files:**
- Modify: `packages/demo-web/package.json`
- Create: `packages/demo-web/playwright.config.ts`

**Step 1: Add a failing “playwright is wired” test**

**Files:**
- Create: `packages/demo-web/e2e/smoke.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test("demo-web loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("OpenAgentic Demo (Web)")).toBeVisible();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-web test:e2e`  
Expected: FAIL (Playwright not installed/configured).

**Step 3: Minimal implementation**

- Add dev deps: `@playwright/test`
- Add script: `test:e2e`: `playwright test`
- Set `baseURL` in `playwright.config.ts` to the Vite dev server URL
- Add a helper script to start Vite for e2e (or use Playwright webServer config)

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-web test:e2e`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-web
git commit -m "test(demo-web): add playwright e2e harness"
git push
```

### Task 3: Browser e2e tool loop via network interception

**Files:**
- Create: `packages/demo-web/e2e/tool-loop.spec.ts`

**Step 1: Write failing test**

Intercept `POST /v1/responses` and return a deterministic “tool call then done” sequence.

```ts
import { test, expect } from "@playwright/test";

test("tool loop: model -> tool -> model", async ({ page }) => {
  await page.route("**/v1/responses", async (route) => {
    // Return a minimal OpenAI Responses-style JSON payload with a tool call.
    // Adjust shape to match @openagentic/providers-openai expectations.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        output: [
          { type: "tool_call", id: "c1", name: "WriteFile", arguments: { path: "a.txt", content: "hello\\n" } },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByPlaceholder("Type a message...").fill("please write a file");
  await page.getByRole("button", { name: "Send" }).click();

  // Expect UI to eventually show the file in OPFS list.
  await expect(page.getByText("a.txt")).toBeVisible({ timeout: 10_000 });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/demo-web test:e2e`  
Expected: FAIL until the mocked response matches the provider’s exact parsing expectations (streaming vs JSON shape, tool call encoding).

**Step 3: Minimal implementation**

- Match the exact OpenAI Responses format used by `@openagentic/providers-openai`:
  - If streaming is required, return `text/event-stream` with the right event frames.
  - Ensure tool call IDs/names/arguments line up with `ToolRunner`.
- Keep the test stable:
  - do not require directory picker
  - rely on OPFS-only writes and file list refresh

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/demo-web test:e2e`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/demo-web/e2e
git commit -m "test(demo-web): e2e tool loop via intercepted provider"
git push
```

