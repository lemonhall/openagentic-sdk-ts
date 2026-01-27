# v2 Feature 07: Browser Runner Demo (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Provide a browser demo that runs the same v2 stack in a sandboxed browser environment.

## Goal

Browser demo requirements:

- Uses OPFS as the shadow workspace (`OpfsWorkspace`)
- Uses real `fetch` but **never cookies** (`credentials: "omit"`)
- Can run the agent loop and show streamed assistant output

## Task 1: Minimal UI + OPFS workspace

**Files:**
- Modify: `examples/browser-runner/src/main.ts`

**Acceptance:**
- UI lets user:
  - type prompt
  - see streamed output
  - view current workspace file list

## Task 2: “Import / Commit” workflow

**Files:**
- Create: `examples/browser-runner/src/import.ts`
- Create: `examples/browser-runner/src/commit.ts`

**Acceptance:**
- User chooses a directory via File System Access API
- Import copies into OPFS workspace shadow
- Commit copies OPFS workspace back to directory handle on explicit action

