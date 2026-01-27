# v2 Feature 08: Guides + Quickstarts (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Make it easy for a human to run the Node and Browser demos safely and successfully.

## Goal

Add a user-facing guide set under `docs/guide/` that answers:

- “How do I run the Node demo?”
- “How do I run the Browser demo?”
- “Where does my API key go? What are the security properties?”
- “What is the shadow workspace? When do changes touch my real files?”
- “How do tools work (argv-first), and what’s currently supported?”

## Acceptance (hard)

- A new `docs/guide/` folder exists and is linked from the repo `README.md`
- A new reader can run:
  - Node demo in < 5 minutes (with `OPENAI_API_KEY`)
  - Browser demo in < 5 minutes (with local dev server)

---

## Task 1: Add guide skeleton + TOC

**Files:**
- Create: `docs/guide/README.md`
- Create: `docs/guide/quickstart-node.md`
- Create: `docs/guide/quickstart-browser.md`
- Create: `docs/guide/security.md`
- Create: `docs/guide/tools.md`
- Modify: `README.md`

**Step 1: Write a failing “docs link” test**

- Add `docs/guide/__tests__/readme-links.test.ts` that asserts:
  - `README.md` mentions `docs/guide/README.md`
  - `docs/guide/README.md` links to the quickstarts

Run: `pnpm -C packages/core test`  
Expected: FAIL (missing docs)

**Step 2: Add minimal docs**

- Write minimal, correct docs with exact commands.

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 3: Commit**

Commit message: `docs: add v2 quickstarts and guides`

---

## Task 2: Document the shadow workspace contract

**Files:**
- Modify: `docs/guide/tools.md`
- Modify: `docs/guide/quickstart-node.md`
- Modify: `docs/guide/quickstart-browser.md`

**Step 1: Write a failing assertion (docs)**

- Extend `docs/guide/__tests__/readme-links.test.ts` to assert these phrases exist:
  - “shadow workspace”
  - “commit”
  - “credentials: \\\"omit\\\"”

Run: `pnpm -C packages/core test`  
Expected: FAIL

**Step 2: Update docs**

- Clearly explain:
  - tools only see the shadow workspace
  - real FS is only touched on explicit commit
  - network calls never send cookies/credentials by default

Run: `pnpm -C packages/core test`  
Expected: PASS

**Step 3: Commit**

Commit message: `docs: document sandbox and security model`

---

## Task 3: Add a “manual testing checklist”

**Files:**
- Create: `docs/guide/manual-testing.md`

**Acceptance:**
- Contains copy/paste commands:
  - install deps (`pnpm i`)
  - run node demo
  - run browser demo
  - a minimal prompt that triggers `WriteFileTool` and `ListDirTool`

**Commit message:** `docs: add manual testing checklist`
