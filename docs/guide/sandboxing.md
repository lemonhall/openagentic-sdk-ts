# Sandboxing

OpenAgentic SDK TS is designed around **portable tool semantics** and **defense in depth**.

## The layers

### Browser

- **Browser sandbox**: the platform sandbox already constrains processes and syscalls.
- **Shadow workspace in OPFS**: tools operate on an isolated workspace stored in OPFS (Origin Private File System).
- **Import/commit boundaries**: real filesystem access (File System Access API) happens only on explicit user actions.

### Server (default)

- **WASI sandbox**: tools run as WASI modules with only the configured preopened shadow workspace directory.
- **No Docker required**: the default server path uses a “same-semantics WASI runner” (e.g. `wasmtime`).

### Server (optional hardening)

On the server you can add an **outer sandbox** around the WASI runner process (“sandbox stacking”):

- Inner sandbox: WASI (tool semantics)
- Outer sandbox: OS/VM sandbox (deployment hardening)

This is useful when you want stronger isolation than “only preopen the shadow dir”, without introducing a second toolchain.

## Bubblewrap (`bwrap`) outer sandbox (Linux-only)

Bubblewrap is a production-grade Linux sandbox based on namespaces (and commonly used by Flatpak). In this project it is treated as an *optional wrapper* around the server runner process.

### What it provides

- Restricts filesystem view via bind mounts (only selected directories are visible).
- Can optionally deny network access via `--unshare-net`.
- Helps reduce blast radius of runner compromise.

### What it does not provide

- Not portable (Linux-only; depends on kernel configuration for user namespaces).
- Not a full VM boundary (kernel vulnerabilities are still relevant).
- Does not automatically make unsafe tools safe; policy + audits still matter.

### Enabling in the Node demo

Environment variables:

- `OPENAGENTIC_PROCESS_SANDBOX=bwrap`
- `OPENAGENTIC_PROCESS_SANDBOX_REQUIRED=1` (optional; fail if unavailable)
- `OPENAGENTIC_BWRAP_PATH=bwrap` (optional)
- `OPENAGENTIC_BWRAP_NETWORK=allow|deny` (optional)
- `OPENAGENTIC_BWRAP_RO_BINDS=/usr,/bin,/lib,/lib64,/etc` (optional)

If `bwrap` is unavailable or the OS is not Linux, the demo will warn and continue unless it is required.

