# v7 Feature 04: Docs — Backend Matrix + Operator Guides (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Make sandbox choices obvious to users/operators via a clear matrix and per-platform install/verify sections.

## Tasks

### Task 1: Add a backend matrix table

**Files:**
- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/sandboxing.zh-CN.md`

Matrix columns:

- Platform
- Backend name
- Provides FS isolation? (yes/no/partial)
- Provides network isolation? (yes/no/optional)
- Provides resource limits? (yes/no/partial)
- Install complexity (low/med/high)
- Recommended use cases

### Task 2: Add per-platform “install + verify” recipes

**Files:**
- Modify: `docs/guide/sandboxing.md`
- Modify: `docs/guide/sandboxing.zh-CN.md`

For each backend include:

- Install steps
- Smoke command
- How to enable via env/config

### Task 3: Update plan index and cross-links

**Files:**
- Modify: `docs/plan/index.md` (add v7 section)
- Modify: `docs/plan/2026-01-27-vision-and-core-design.md` (link v7 as future extension)

**Commit:**

```bash
git add docs
git commit -m "docs: sandbox backend matrix and v7 links"
git push
```

