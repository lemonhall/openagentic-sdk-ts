# v7 Plans Index — Cross-Platform Sandbox Backends (Linux/macOS/Windows)

> Goal of v7: expand “pluggable sandbox backends” so server deployments can choose a hardened execution boundary on **Linux, macOS, and Windows** while keeping the SDK’s core tool APIs stable.

## Why v7 exists

v5 introduced a server-side “outer sandbox adapter” contract (wrapping the WASI runner process) and a first implementation using Bubblewrap (Linux-only). v6 added a Bubblewrap-native engine (Linux-only, host tools).

Real deployments need a story on:

- Linux (Bubblewrap, nsjail, systemd-run)
- macOS (sandbox-exec if available; otherwise best-effort hardening + clear docs)
- Windows (Job Objects / AppContainer / Windows Sandbox—pick a pragmatic baseline)

v7 explicitly focuses on **backend diversity**, not on tool parity across platforms.

## Success criteria (hard)

- A unified “sandbox backend selection” config exists (by name + options).
- Each OS has at least one supported backend:
  - Linux: `bwrap` (existing) + one additional backend (`nsjail` or `systemd-run`)
  - macOS: `sandbox-exec` backend (best-effort) with clear version caveats
  - Windows: Job Object–based backend (baseline) with clear limitations
- Each backend has:
  - deterministic argv generation (unit tests)
  - a skip-gated integration test (runs only when deps exist + OS matches)
  - documentation: install, verify, known limitations

## Execution order (recommended)

1. `v7-feature-00-sandbox-backend-registry.md`
2. `v7-feature-01-linux-nsjail-or-systemd-run.md`
3. `v7-feature-02-macos-sandbox-exec.md`
4. `v7-feature-03-windows-jobobject.md`
5. `v7-feature-04-docs-matrix-and-guides.md`

