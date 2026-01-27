# v5 Feature 01: Bubblewrap (`bwrap`) Outer Sandbox (Implementation Plan)

> **For Codex:** REQUIRED SKILL: `$tashan-development-loop` for implementation.  
> **Goal:** Provide a production-grade Linux outer sandbox option by running `wasmtime` under Bubblewrap.

## Constraints

- Linux-only (`bwrap` requires user namespaces).
- No Docker.
- Must preserve the same tool semantics as the plain `wasmtime` runner (this is a wrapper).
- Must not silently weaken the shadow-workspace boundary (only mount the shadow dir read/write; everything else read-only or tmpfs).

## Tasks

### Task 1: Implement Bubblewrap wrapper

**Files:**
- Create: `packages/wasi-runner-wasmtime/src/bubblewrap.ts`
- Test: `packages/wasi-runner-wasmtime/src/__tests__/bubblewrap.test.ts`

**Spec (proposed):**
- Export `createBubblewrapProcessSandbox(opts)` returning `ProcessSandbox`.
- Wrapper builds:
  - `cmd = bwrapPath`
  - `args = [ ...bwrapArgs, wasmtimePath, ...wasmtimeArgs ]`
- Default mounts/policy:
  - `--die-with-parent`
  - `--new-session`
  - `--proc /proc`
  - `--dev /dev`
  - `--tmpfs /tmp`
  - `--ro-bind` common system dirs needed by `wasmtime` (opt-in list; document)
  - `--bind` shadow workspace dir to a stable path (e.g. `/workspace`) and `--chdir /workspace`
- Network policy:
  - default `allow` (no `--unshare-net`) to match current behavior; document how to switch to `deny` (`--unshare-net`) for deployments that don’t need network.

**Acceptance:**
- Unit tests validate generated argv for:
  - mount of shadow dir only
  - `--unshare-net` toggling
  - deterministic ordering

### Task 2: Wire into demo-node

**Files:**
- Modify: `packages/demo-node/src/runtime.ts` (or config entrypoint used today)
- Docs: `docs/guide/security.md` (add a section “Outer sandbox: Bubblewrap (Linux)”)

**Acceptance:**
- Demo can be run with an env flag (proposed): `OPENAGENTIC_PROCESS_SANDBOX=bwrap`
- If `bwrap` is not available or not Linux, demo prints a clear warning and continues without it (unless `OPENAGENTIC_PROCESS_SANDBOX_REQUIRED=1`).

**Commit:** `feat(wasi-runner-wasmtime): bubblewrap outer sandbox`

