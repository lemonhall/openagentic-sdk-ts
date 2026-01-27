# v3 Feature 00: WASI Runnable Slice Definition (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Define what “WASI-first” means for this repo, without regressing the v2 runnable slice.

## Goal

By the end of v3, a developer can run the same agent demos as v2, but with **WASI-backed command execution** powering `Bash`:

- `Bash` uses `Shell(script)` → `Command(argv)` over installed WASI bundles by default (with a safe fallback).
- The WASI execution environment sees **only the shadow workspace**.
- Browser and server use the **same bundle artifacts** and produce the same outputs for the same command lines (within declared limits).

## Success criteria (hard)

- `pnpm test` passes.
- Node demo:
  - `OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project . --wasi`
  - In a turn, the agent can run pipelines and redirects over WASI tools (e.g. `Bash: { command: "ls | grep package" }`).
- Browser demo:
  - Same behavior behind a toggle/flag (no cookies; no API keys in the browser).
  - WASI mode executes in a WebWorker and uses OPFS-backed FS for file I/O.
- Bundle installation works at runtime from the official registry URL, with:
  - mandatory sha256 checks (already present),
  - mandatory signature verification for official sources (v3-feature-05).

## Non-goals (explicit)

- Implementing “all of Unix” or full bash semantics.
- Shipping an offline-first bundle cache (runtime download is allowed).
- Shipping non-official registries with signature trust (official only).

## Design: wiring strategy

We keep the v2 runnable path intact and add a **WASI mode** that can be turned on:

- Demos: `--wasi` (Node) and a UI toggle (browser).
- Tools: `Bash` becomes a thin facade that can run via:
  - **WASI backend** (preferred, when bundles + runner are available)
  - **TS builtins backend** (fallback, for environments without WASI setup)

This avoids breaking “it runs now” while enabling the long-term tool story.

## Tasks (high level)

1. Define a single “WASI toolchain availability” check (bundles installed + runner ready).
2. Extend demos to expose a WASI toggle (without changing default behavior).
3. Add tests proving backend selection and parity for a small command set.

**Commit:** `docs(plan): define v3 WASI runnable slice`

