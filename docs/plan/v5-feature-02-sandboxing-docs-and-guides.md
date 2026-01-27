# v5 Feature 02: Sandboxing Docs & Guides (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Make “pluggable sandboxes” understandable for users and operators (what it protects, what it doesn’t, and how to enable it).

## Tasks

### Task 1: Update vision cross-links + plan index

**Files:**
- Modify: `docs/plan/index.md` (add v5 section)
- Modify: `docs/plan/2026-01-27-vision-and-core-design.md` (already mentions adapters; link v5 plans)

Acceptance:
- `docs/plan/index.md` links to `docs/plan/v5-index.md`.

### Task 2: Add operator guide

**Files:**
- Modify: `docs/guide/security.md`
- Create: `docs/guide/sandboxing.md`

Acceptance:
- Guide explains the model:
  - Browser: browser sandbox + OPFS shadow workspace
  - Server: WASI sandbox + optional outer sandbox
  - What Bubblewrap does/doesn’t do (Linux-only, kernel knobs, network choice)

**Commit:** `docs: add sandboxing guide and v5 plan links`

