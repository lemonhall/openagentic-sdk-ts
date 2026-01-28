# Sandboxing

As of **v13 (2026-01-28)**, this repo **abandons WASI toolchains/bundles/registries**. The practical sandbox story is:

- **Browser:** tools run in the browser sandbox and operate on an OPFS **shadow workspace** (no WASI execution).
- **Node/server:** tools run as **host-native processes** inside an OS sandbox (when available), with the filesystem view restricted to a **shadow workspace directory**.

## The layers

### Browser

- **Browser sandbox:** the platform sandbox already constrains processes and syscalls.
- **Shadow workspace in OPFS:** tools operate on an isolated workspace stored in OPFS (Origin Private File System).
- **Import/commit boundaries:** real filesystem access (File System Access API) happens only on explicit user actions.

### Server (default)

- **Shadow workspace directory:** tools see only a sandboxed shadow directory (not the user’s real repo).
- **OS sandbox (optional but recommended):** wrap tool execution with a backend like Bubblewrap/nsjail/sandbox-exec/jobobject.

## Backend matrix (server)

| Platform | Backend | FS isolation | Network isolation | Resource limits | Install | Recommended use cases |
|---|---|---|---|---|---|---|
| Linux | `bwrap` | yes | optional | partial | med | production-grade hardening |
| Linux | `nsjail` | partial | optional | partial | high | best-effort hardening when Bubblewrap isn’t available |
| macOS | `sandbox-exec` | partial | optional | no | low | best-effort hardening |
| Windows | `jobobject` | no | no | partial | low | timeout/process-tree containment |
| any | `none` | no | no | partial | low | debugging only (not recommended for untrusted prompts) |

## Selecting a backend (Node/server)

Use `@openagentic/sdk-node` to select a backend and construct a `NativeRunner`:

```ts
import { parseSandboxConfig, getSandboxBackend } from "@openagentic/sdk-node";

const shadowDir = "/path/to/shadow";
const cfg = parseSandboxConfig({ backend: "bwrap", options: { network: "deny" } });
const backend = getSandboxBackend(cfg.backend);
const nativeRunner = backend.createNativeRunner({ config: cfg, shadowDir });
```

## Native engine diagram (v6)

Rendered diagram for the **server native engine + Bubblewrap** flow:

![Native engine (Bubblewrap) sequence diagram](native_sandbox_sequenceDiagram_v6.png)

