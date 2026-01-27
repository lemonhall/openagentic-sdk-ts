# v5 Plans Index — Pluggable Outer Sandboxes (Server Hardening)

> Goal of v5: keep WASI as the portable “same-semantics” tool runtime, while allowing **server deployments** to wrap tool execution in additional OS/VM sandboxes (Bubblewrap, nsjail, gVisor, Firecracker, etc.) via a stable adapter interface.

## Why v5 exists

v4 makes the default tool experience WASI-first across browser + server. That satisfies the “same semantics” requirement, but production server deployments often want **defense in depth**:

- A second isolation boundary around the runner process (filesystem, syscalls, resources).
- Stronger blast-radius reduction than “only preopen the shadow dir”.
- Auditable, policy-driven runtime hardening that can vary by environment.

This should *not* require changing tool semantics or maintaining a separate “Linux userland toolchain” build: the outer sandbox should wrap the existing WASI runner.

## v5 success criteria (hard)

- A stable server-side “outer sandbox adapter” contract exists and is documented.
- `@openagentic/wasi-runner-wasmtime` can be configured to run `wasmtime` under an outer sandbox wrapper (Linux Bubblewrap first).
- Demos can enable/disable the outer sandbox with a single config flag (and degrade gracefully when unsupported).
- All executions produce audit records (what wrapper was used, what was mounted, what was denied).

## Execution order (recommended)

1. `v5-feature-00-outer-sandbox-adapter-contract.md`
2. `v5-feature-01-bubblewrap-outer-sandbox.md`
3. `v5-feature-02-sandboxing-docs-and-guides.md`

