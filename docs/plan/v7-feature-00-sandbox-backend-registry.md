# v7 Feature 00: Sandbox Backend Registry + Selection (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Provide a stable way to select a sandbox backend by name on the server, without leaking backend specifics into tools.

**Architecture:** Introduce a small “backend registry” that maps:

- `engine` (WASI vs native)
- `sandbox backend` (bwrap / nsjail / systemd-run / sandbox-exec / jobobject / none)

to a concrete runner wrapper.

**Tech Stack:** TypeScript, Vitest.

### Task 1: Define config types

**Files:**
- Create: `packages/node/src/sandbox/config.ts`
- Test: `packages/node/src/__tests__/sandbox-config.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseSandboxConfig } from "../sandbox/config.js";

describe("parseSandboxConfig", () => {
  it("parses a named backend with options", () => {
    const cfg = parseSandboxConfig({ backend: "bwrap", options: { network: "deny" } });
    expect(cfg.backend).toBe("bwrap");
    expect(cfg.options.network).toBe("deny");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/node test -- --run sandbox-config`  
Expected: FAIL (module missing).

**Step 3: Minimal implementation**

Implement `parseSandboxConfig(...)`:

- validates `backend` in a whitelist
- normalizes default options
- returns a typed config object

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/node test -- --run sandbox-config`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/node
git commit -m "feat(node): sandbox backend config"
git push
```

### Task 2: Implement a backend registry

**Files:**
- Create: `packages/node/src/sandbox/registry.ts`
- Test: `packages/node/src/__tests__/sandbox-registry.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { getSandboxBackend } from "../sandbox/registry.js";

describe("getSandboxBackend", () => {
  it("returns a backend implementation by name", () => {
    const b = getSandboxBackend("bwrap");
    expect(b.name).toBe("bwrap");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/node test -- --run sandbox-registry`  
Expected: FAIL.

**Step 3: Minimal implementation**

Registry returns an object that can construct:

- `ProcessSandbox` (for WASI/wasmtime wrapping), or
- `NativeRunner` (for native engine), depending on engine.

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/node test -- --run sandbox-registry`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/node
git commit -m "feat(node): sandbox backend registry"
git push
```

