# v6 Feature 04: Docs — Native Engine Tradeoffs (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Make the native engine’s portability/security tradeoffs explicit and provide operator instructions (Ubuntu 24.04).

**Architecture:** Update guides to clearly distinguish:

- WASI engine (portable, browser-aligned, signed bundles)
- Native engine (Linux-only, uses host tools, not browser-aligned)
- Bubblewrap as a process sandbox usable in both contexts (outer wrapper or native engine sandbox)

**Tech Stack:** Markdown docs.

### Task 1: Update sandboxing guide

**Files:**
- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/sandboxing.zh-CN.md`

Content requirements:

- Add an explicit “Engines” section: `wasi` vs `native`.
- Add a “Native engine risks” section (host tool variability, broader filesystem exposure, reproducibility).
- Add env/config examples:
  - `OPENAGENTIC_TOOL_ENGINE=native`
  - `OPENAGENTIC_PROCESS_SANDBOX=bwrap` (if used by native runner)

### Task 2: Update security guide

**Files:**
- Modify: `docs/guide/security.md`

Content requirements:

- Document what `bwrap` does/doesn’t protect in native mode.
- Recommend `OPENAGENTIC_BWRAP_NETWORK=deny` for safer defaults when possible.

**Commit:**

```bash
git add docs/guide
git commit -m "docs: native engine tradeoffs"
git push
```

