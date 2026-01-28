# v13 Plans Index — Abandon WASI Toolchains (Go Native on Node; TS-only in Browser)

> Goal of v13: **hard pivot** away from WASI toolchains/bundles/registries entirely.
>
> - **Node/server**: run **host-native** commands inside an OS sandbox (Bubblewrap/nsjail/etc) against the shadow workspace.
> - **Browser**: keep a small, deterministic **TS-native** toolset over OPFS (no WASI execution).
>
> All prior “WASI distro / signed bundles / one-wasm-per-command” work is treated as **abandoned** as of **2026-01-28**.

## Why v13 exists

The WASI toolchain direction repeatedly pulled the project into a high-effort loop:

- each missing Linux utility becomes “another wasm build / another manifest / another parity trap”
- the LLM tries commands that don’t exist (or behave differently), wasting turns

At the same time, “just run BusyBox in WASM” is not a reliable escape hatch in our constraints (and BusyBox does not ship an official WASM/WASI binary).

So v13 chooses the pragmatic route: **stop trying to ship a Linux userland in WASM**, and instead harden host-native execution on Node.

## Strategy (decisions)

### 1) Node/server runs host-native tools under a sandbox

Use a `NativeRunner` to execute `bash -lc "<script>"` (and other host binaries) with:

- filesystem view restricted to the shadow workspace
- network controls (deny by default where possible)
- resource limits + timeouts

### 2) Browser stays TS-native (no WASI execution)

Keep the browser demo focused on:

- OPFS shadow workspace
- deterministic TS tools (including a restricted TS `Bash`)

### 3) Abandoned directions (as of 2026-01-28)

- Any WASI toolchain strategy (including “one command == one `.wasm` file”).
- “Official registry + signature enforced installs” as a distribution strategy.
- “Same semantics across browser/server via WASI execution” as a top-level project goal.

## Plans (suggested execution order)

1. `v13-feature-00-abandon-wasi-toolchain-go-native.md`
