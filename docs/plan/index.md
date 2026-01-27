# v1 Plans Index

This directory contains the project vision and a set of executable v1 feature plans.

## Core documents

- Vision + core design: `2026-01-27-vision-and-core-design.md`

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

## Non-v1 / future plans (tracked in design doc)

See “Future Extensions” in `2026-01-27-vision-and-core-design.md`.
