# v4 Plans Index — “WASI Complete” Slice

> **Status:** ABANDONED as of v13 (2026-01-28). The shadow-workspace model remains, but v13 removes WASI toolchains/bundles/registries and uses host-native execution on Node/server and TS-native tools in the browser.

> Goal of v4: close the remaining gaps in the original “same-semantics WASI runner + shadow workspace” vision so the **default** tool experience is WASI-backed, portable across browser + server, and safe-by-default (official registry only, signed bundles).

## Why v4 exists

v2 made the repo runnable (real LLM + multi-turn + tool loop). v3 started converging tooling toward WASI (WASI-backed `Bash` preview, a minimal `core-utils` sample bundle, and explicit plans for worker/OPFS + wasmtime mount + signatures + Python).

However, the “初心” still isn’t fully met:

- Browser WASI isn’t yet **Worker + OPFS sync FS** (preview1 hostcalls are sync).
- Server WASI still uses snapshot-per-exec instead of mounting a **shadow directory**.
- Official registry signatures are still deferred.
- WASI network (`fetch`) isn’t wired end-to-end.
- Tool bundles are still too small to make WASI-first `Bash` practical by default.
- Python support is tracked but unimplemented.

v4 makes these items real and makes the WASI path the default (with safe fallbacks where needed).

## v4 success criteria (hard)

- **Node:** `pnpm -C packages/demo-node start -- --project .` uses WASI-first `Bash` by default when `wasmtime` is available, operating only on the shadow workspace, and remains usable for real projects (no per-command snapshot round-trips).
- **Browser:** demo runs WASI modules inside a Worker with OPFS-backed sync FS, with the same “shadow workspace only” semantics as Node.
- **Official registry:** bundle installs enforce **sha256 + signature** for official sources; demos accept only official sources by default.
- **WASI network:** tools/bundles can use injected `fetch` (credentials omitted), with strict limits and event auditing.
- **Tooling baseline:** `core-utils` bundle includes enough commands to cover common agent workflows (`ls`, `cat`, `grep`, `mkdir`, `rm`, `cp`, `mv`, `head`, `tail`, `wc`, `pwd`).
- **Python:** a `Python` tool exists as a WASI runtime bundle (phase A: MicroPython) and is enabled by default in demos once installed.

## Execution order (recommended)

1. `v4-feature-00-slice-definition.md` — acceptance + wiring strategy + non-goals
2. `v4-feature-01-official-registry-signatures.md` — canonical JSON + Ed25519 verify + enforce official policy
3. `v4-feature-02-core-utils-bundle-v1.md` — expand `core-utils` to a usable baseline
4. `v4-feature-03-node-wasmtime-mounted-shadow-dir.md` — mount shadow dir (no snapshot-per-exec)
5. `v4-feature-04-browser-worker-opfs-wasi-runner.md` — Worker runner + OPFS sync FS
6. `v4-feature-05-wasi-netfetch-capability.md` — inject `fetch` into WASI + policy + audit events
7. `v4-feature-06-wasi-first-bash-default.md` — make WASI-first the default with fallback
8. `v4-feature-07-python-runtime-bundle.md` — MicroPython bundle + `Python` tool (CPython tracked)

## Notes

- v4 intentionally reuses the v3 documents as historical context, but the v4 plans are the authoritative “do it now” execution set.
- Each feature must follow the `$tashan-development-loop` discipline (TDD + evidence + commit/push per completed plan).
