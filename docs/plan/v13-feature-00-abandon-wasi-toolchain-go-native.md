# v13 Feature 00: Abandon WASI Toolchains; Go Native on Node (Implementation Plan)

> **Goal:** Fully abandon the WASI toolchain/bundles/registry direction and make the default Node/server experience run **host-native** tools inside an OS sandbox against the shadow workspace. The browser demo remains TS-native only.

## Problem / Current State

- The repo contains a large WASI toolchain surface area:
  - bundle manifests, installers, caches, signatures
  - WASI runners (web + wasmtime)
  - tools (`Command`, `Shell`, WASI-backed `Bash`, WASI `Python`)
- This creates ongoing maintenance cost and “parity traps”.

## Decision (hard pivot)

As of **2026-01-28**, we treat all WASI toolchain work as **abandoned**:

- remove WASI runners and bundles from the default path
- remove WASI bundle distribution concepts from docs
- delete WASI/bundles code that would otherwise rot and confuse contributors

## New default architecture

### Node/server

- Use a `NativeRunner` to execute host-native commands under an OS sandbox (Bubblewrap/nsjail/sandbox-exec/jobobject where available).
- The runner’s filesystem view is restricted to the shadow workspace directory.
- `Bash` in Node uses `bash -lc "<script>"` (full shell syntax; explicitly non-portable vs browser).

### Browser

- No WASI execution.
- Keep TS-native tools over OPFS shadow workspace (restricted TS `Bash`).

## Acceptance (hard)

1. `pnpm -C packages/demo-node start -- --project .` runs with host-native `Bash` by default.
2. `pnpm -C packages/demo-web dev` runs without any WASI worker/bundle plumbing; toolset remains usable.
3. Workspace safety remains unchanged:
   - tools operate on shadow workspace
   - real FS writes happen only on explicit commit
4. Repo contains no WASI/bundles packages on the main build/test path.
5. Docs and tests do not claim WASI parity, registries, or bundle installs.

## Scope

### In scope

- Remove packages:
  - `packages/bundles`
  - `packages/wasi-runner`
  - `packages/wasi-runner-web`
  - `packages/wasi-runner-wasmtime`
- Remove tools that depend on WASI/bundles:
  - `CommandTool`, `ShellTool`, `PythonTool` (WASI)
  - WASI modes/toggles in demos and docs
- Update demos:
  - Node demo defaults to `NativeBashTool`
  - Browser demo removes WASI toggles/worker/bundle cache
- Update docs:
  - vision, sandboxing, quickstarts, tools reference, plan indices
- Update tests to match the new reality.

### Out of scope

- Cross-environment “same semantics” (explicitly abandoned).
- A browser-native full shell / Linux userland.

