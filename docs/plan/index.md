# Plans Index

This directory contains the project vision and a set of executable v1 feature plans.

## Core documents

- Vision + core design: `2026-01-27-vision-and-core-design.md`

## v2 plans (make it runnable)

v1 delivered the core “tool-first + WASI + shadow workspace” primitives. v2 is about making the repo **actually run an agent end-to-end** against a real LLM backend (multi-turn, tool calling, streaming), in both Node/server and browser.

- v2 index: `v2-index.md`

## v3 plans (make WASI the default tool engine)

v3 is about closing the gap between the original “same-semantics WASI runner” vision and the v2 runnable slice. Concretely: ship a usable official tool bundle set and make `Bash`/pipelines run via WASI in both browser and server, while keeping the shadow workspace isolation model.

- v3 index: `v3-index.md`

## v4 plans (finish “same-semantics WASI”)

v4 closes the remaining “初心” gaps: worker/OPFS WASI in browser, mounted shadow dir in Node, official signature verification, WASI netfetch wiring, a usable `core-utils` bundle baseline, and Python runtime tooling.

- v4 index: `v4-index.md`

## v5 plans (pluggable outer sandboxes)

v5 adds a stable server-side “outer sandbox adapter” contract so deployments can harden tool execution by wrapping the WASI runner process with OS/VM sandboxes (Bubblewrap first; others later).

- v5 index: `v5-index.md`

## v6 plans (Bubblewrap-native engine)

v6 adds a second **server-side execution engine** that runs host-native commands under Bubblewrap (Linux-only) and intentionally does not ship any tool bundles. This is useful for deployments that want “use whatever is installed on the host” and accept non-portability vs browser.

- v6 index: `v6-index.md`

## v7 plans (cross-platform sandboxes)

v7 expands server sandbox backends across Linux/macOS/Windows (best-effort, with clear limitations) while keeping the core tool APIs stable.

- v7 index: `v7-index.md`

## v8 plans (close remaining vision gaps)

v8 returns to the original “vision story” and closes the remaining gaps that still feel prototype-grade: browser session durability, reviewable changesets UI, server WASI `netFetch` correctness, a real Python runtime story, hosted official bundles, and an e2e “happy path” test slice.

- v8 index: `v8-index.md`

## v9 plans (convergence: production-grade Python, bundles, server netFetch, release hardening)

v9 is a convergence pass: make the repo’s **vision and defaults** match what a real user should do today, and close the remaining “prototype-grade” gaps (notably: a real WASI Python runtime, a first-class “official bundles” story, a practical server `netFetch` runner story, and stronger release/e2e guardrails).

- v9 index: `v9-index.md`

## v10 plans (POSIX-ish `sh`: real shell semantics + minimal toolchain)

v10 makes the built-in “Bash” tool live up to its name: push the shell semantics toward **POSIX `sh`** (quoting, expansion order, redirects, pipes, exit code semantics, core builtins) and ship a pragmatic “minimal coreutils-like” command set so common scripts actually run in WASI and in the TS-native fallback.

- v10 index: `v10-index.md`

## v1 feature plans

Suggested execution order:

1. `v1-feature-00-foundation.md` — Repo scaffold, packages, CI, basic types/tests
2. `v1-feature-01-events-sessions.md` — Event model + session store + replay primitives
3. `v1-feature-02-shadow-workspace-opfs.md` — Shadow workspace in OPFS, import/export
4. `v1-feature-03-tools-permissions.md` — Tool registry + permission gate + audit events
5. `v1-feature-04-wasi-runner.md` — WASI runner interface + web/wasmtime adapters
6. `v1-feature-05-tool-bundles-registry.md` — Bundle manifests, installs, integrity, caches
7. `v1-feature-06-command-tool.md` — `Command(argv)` tool over WASI + resource limits
8. `v1-feature-07-shell-tool.md` — `Shell(script)` compiler (subset B) + pipelines
9. `v1-feature-08-netfetch-capability.md` — Runner-injected `fetch` capability + policy
10. `v1-feature-09-wasi-preview1-fs-args-env.md` — WASI argv/env + sandboxed preopen root + minimal FS syscalls
11. `v1-feature-10-command-tool-workspace-fs.md` — Mount workspace as WASI FS for `Command(argv)` and commit back
12. `v1-feature-11-tool-runner-context-injection.md` — Inject host context (e.g. workspace) into tool execution
13. `v1-feature-12-registry-fetch-omit-credentials.md` — Registry downloads default to `credentials: "omit"`

## Non-v1 / future plans (tracked in design doc)

See “Future Extensions” in `2026-01-27-vision-and-core-design.md`.
