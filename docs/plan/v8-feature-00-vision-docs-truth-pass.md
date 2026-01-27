# v8 Feature 00: Vision + Docs “Truth Pass” (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Ensure the repo’s “story” (vision + READMEs + guides) matches actual behavior as of v7, and explicitly documents remaining v8 gaps.

**Architecture:** No runtime changes. This is a documentation and “guardrail test” pass so future changes don’t silently drift docs vs reality.

**Tech Stack:** Markdown, Vitest.

### Task 1: Update the vision doc to “as of v7”

**Files:**
- Modify: `docs/plan/2026-01-27-vision-and-core-design.md`

**Step 1: Write a failing doc test (small guardrail)**

Add assertions that v8 is discoverable from docs:

**Files:**
- Modify: `packages/core/src/__tests__/docs-guides.test.ts`

```ts
const plans = await readText("docs/plan/index.md");
expect(plans).toContain("v8 index");
expect(plans).toContain("v8-index.md");
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: FAIL (until v8 links and/or vision is updated; depending on what’s asserted).

**Step 3: Update `docs/plan/2026-01-27-vision-and-core-design.md`**

Make these edits (minimal, factual):

- Change “Status (as of v4 …)” to “Status (as of v7 …)”
- Move “pluggable outer sandboxes” + “cross-platform backends” out of “future extensions” into “implemented”
- Update “Remaining gaps vs the original story” to match v8:
  - browser durable session store
  - reviewable changeset UI
  - server WASI `netFetch` constraints for `wasmtime` CLI runner
  - Python runtime bundle reality (placeholder → roadmap)
- Add a “Next milestone (v8)” section pointing to `docs/plan/v8-index.md`

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/plan/2026-01-27-vision-and-core-design.md packages/core/src/__tests__/docs-guides.test.ts
git commit -m "docs: refresh vision status (v7) and v8 links"
git push
```

### Task 2: Align repo READMEs and guides with current defaults

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/guide/quickstart-node.md`
- Modify: `docs/guide/quickstart-browser.md`
- Modify: `docs/guide/tools.md`

**Step 1: Write a failing test for the README/tool-engine claim**

**Files:**
- Modify: `packages/core/src/__tests__/docs-guides.test.ts`

Add a strict assertion that the README does not claim “WASI tools exist but are off by default” (if that’s still present), and does mention `OPENAI_BASE_URL` and the browser proxy flow.

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: FAIL.

**Step 3: Update docs**

- Ensure Node quickstart documents `OPENAI_BASE_URL` and the sandbox backend selection environment variables.
- Ensure browser quickstart clearly states:
  - “no cookies” guarantee (`credentials: "omit"`)
  - proxy role (CORS + key isolation)
  - tool bundle base URL concept (official bundles)
- Ensure tools guide matches implemented toolset names and where they run:
  - TS-native workspace tools
  - WASI `Command`/`Shell` path
  - native engine path (Linux-only) is optional and non-parity

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/core test -- --run docs-guides`  
Expected: PASS.

**Step 5: Commit**

```bash
git add README.md README.zh-CN.md docs/guide packages/core/src/__tests__/docs-guides.test.ts
git commit -m "docs: align readmes and quickstarts with current defaults"
git push
```

