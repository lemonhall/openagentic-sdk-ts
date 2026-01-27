# v3 Plans Index — “WASI Convergence” Slice

> Goal of v3: make the **default** “Bash-like” tool experience run via **WASI modules** with the **same semantics** in browser and server, without breaking the v2 runnable agent slice.

## Why v3 exists

v2 intentionally shipped a runnable agent and a “real baseline” toolset using pure TypeScript implementations (shadow-workspace-native `Bash` builtins, workspace file tools, and web tools). This made the SDK usable immediately, but it does not fully realize the original vision:

- WASI runners exist, but are not wired into the default demos/toolset.
- Tool bundles exist, but the sample bundle is too small to power a real `Bash` experience.
- Official registry signature verification is intentionally deferred.

v3 closes this gap while keeping the v2 demo UX and security model (shadow workspace + explicit commit boundaries).

## v3 success criteria (hard)

- Node demo can run a multi-turn agent that uses **WASI-backed `Bash`** for common operations (pipes/redirects) against the shadow workspace:
  - `OPENAI_API_KEY=... pnpm -C packages/demo-node start -- --project . --wasi`
- Browser demo can do the same without exposing API keys or cookies:
  - `OPENAI_API_KEY=... pnpm -C packages/demo-proxy start`
  - `pnpm -C packages/demo-web dev`
  - enable WASI mode from UI (or a query flag) and confirm `Bash` runs via WASI modules
- Tool bundles can be installed at runtime from an **official registry** with mandatory integrity checks, and mandatory signature checks for official sources.

## v3 feature plans (execution order)

1. `v3-feature-00-wasi-runnable-slice-definition.md` — acceptance + non-goals + wiring strategy (keep v2 runnable)
2. `v3-feature-01-core-utils-bundle.md` — ship an actually-useful official `core-utils` bundle (WASI)
3. `v3-feature-02-node-wasmtime-shadow-dir.md` — make server execution mount the shadow workspace (no snapshot-per-exec)
4. `v3-feature-03-browser-worker-opfs-wasi-runner.md` — browser WASI runner in a WebWorker with OPFS-backed sync FS
5. `v3-feature-04-wasi-first-bash.md` — make `Bash` run as `Shell(script)` → `Command(argv)` over installed bundles (with fallback)
6. `v3-feature-05-official-registry-signatures.md` — implement official signature verification and enforce it

## Explicit non-goals (for v3)

- “Full bash” semantics (job control, command substitution, heredoc, etc.)
- Docker-based execution (use `wasmtime` or equivalent WASI host)
- A comprehensive Linux-like distro image (tracked as a later tool-bundle expansion)

## Optional v3+ extensions (tracked, not required)

- `python` bundle (CPython-in-WASI or Pyodide-style packaging; policy + size/limits required)
- `WebSearch` in browser via a proxy endpoint (avoid exposing Tavily key)
- Bundle dependency graph + version pinning/lockfiles

