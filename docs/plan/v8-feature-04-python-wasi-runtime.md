# v8 Feature 04: Real `Python` Tool via WASI Runtime Bundle (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Replace the current placeholder `lang-python` bundle with a real, sandboxed Python runtime that can execute `python -c "<code>"` reliably in both browser and server WASI runners.

**Architecture (recommended):**

- Ship a real WASI Python runtime as an **official bundle** versioned independently (e.g. `lang-python@0.1.0`).
- Keep the tool API stable: `Python` tool continues to call `python -c ...` via `CommandTool`.
- Scope the runtime to “agent-usable basics”:
  - arithmetic, strings, JSON parsing/formatting
  - basic stdlib (as available)
  - strict resource limits (time/memory/stdout)
- Defer `pip`/package installs until there is a clear policy (still possible later via separate bundle).

**Candidate runtimes:**

1. **MicroPython (WASI build produced by this repo)** (recommended first milestone)
   - Smaller footprint, easier to ship.
   - Sufficient for many “agent scripting” tasks.
2. **CPython (WASI)** (future)
   - More complete stdlib, but heavier and harder to build/ship.

**Tech Stack:** WASI toolchain (wasi-sdk), TypeScript, Vitest.

### Task 1: Introduce an “official bundles” directory and a generator script

**Files:**
- Create: `packages/bundles/official/README.md`
- Create: `packages/bundles/scripts/generate-official-lang-python.mjs`

**Step 1: Write a failing bundles test that expects a non-stub python.wasm**

**Files:**
- Create: `packages/bundles/src/__tests__/official-lang-python.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

describe("official lang-python bundle", () => {
  it("ships a non-trivial python.wasm", async () => {
    const wasmPath = join(process.cwd(), "official", "bundles", "lang-python", "0.1.0", "python.wasm");
    const st = await stat(wasmPath);
    expect(st.size).toBeGreaterThan(50_000);
    const bytes = await readFile(wasmPath);
    expect(bytes.slice(0, 4).toString("hex")).toBe("0061736d"); // \\0asm
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/bundles test -- --run official-lang-python`  
Expected: FAIL (bundle doesn’t exist yet).

**Step 3: Minimal implementation**

- Add `packages/bundles/official/README.md` describing layout:
  - `official/bundles/<name>/<version>/manifest.json`
  - `official/bundles/<name>/<version>/<asset files>`
- Add `generate-official-lang-python.mjs` that:
  - takes an input `python.wasm` (built elsewhere in Task 2)
  - computes sha256 + size
  - produces `manifest.json`
  - signs with the existing dev key (until real release key management is introduced)

**Step 4: Run test to verify it passes (still red until Task 2 produces the wasm)**

Run: `pnpm -C packages/bundles test -- --run official-lang-python`  
Expected: still FAIL until a real wasm exists (that’s fine; keep this task small and commit the scaffolding only if it doesn’t break existing tests).

**Step 5: Commit**

```bash
git add packages/bundles/scripts packages/bundles/official packages/bundles/src/__tests__/official-lang-python.test.ts
git commit -m "feat(bundles): scaffold official lang-python bundle"
git push
```

### Task 2: Build MicroPython to `wasm32-wasi` and produce `python.wasm`

**Files:**
- Create: `packages/bundles/scripts/build-micropython-wasi.sh`
- Modify: `packages/bundles/official/bundles/lang-python/0.1.0/python.wasm` (generated artifact)
- Modify: `packages/bundles/official/bundles/lang-python/0.1.0/manifest.json` (generated)

**Step 1: Document build prerequisites (in script header + official README)**

- Install `wasi-sdk` (pin a version)
- Install `make`, `python3`, `git`

**Step 2: Implement the build script**

Script behavior (idempotent):

- clones/pins `https://github.com/micropython/micropython` to a known commit/tag
- builds the wasm32-wasi port with flags:
  - enable `-c` execution
  - disable heavy/unsafe features by default
- writes output to `packages/bundles/official/bundles/lang-python/0.1.0/python.wasm`
- runs `generate-official-lang-python.mjs` to write/sign the manifest

**Step 3: Run the bundles test**

Run: `pnpm -C packages/bundles test -- --run official-lang-python`  
Expected: PASS.

**Step 4: Commit**

If the wasm is too large to commit in this repo, adjust the plan:

- Commit only the script + manifest template, and
- Make `v8-feature-05-official-bundles-hosting.md` responsible for hosting the binary and updating tests to fetch it in CI.

Otherwise, commit the generated wasm for now:

```bash
git add packages/bundles/official packages/bundles/scripts
git commit -m "feat(bundles): add micropython wasi runtime bundle"
git push
```

### Task 3: Add an integration test that runs `PythonTool` end-to-end (WASI in-process)

**Files:**
- Create: `packages/tools/src/__tests__/python-wasi.integration.test.ts`

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest";
import { installBundle } from "@openagentic/bundles";
import { CommandTool } from "../command.js";
import { PythonTool } from "../python/python.js";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

describe("PythonTool (WASI integration)", () => {
  it("runs python -c and returns stdout", async () => {
    const cache = { read: async () => null, write: async () => {} };
    const registry = {
      baseUrl: "https://official.local",
      isOfficial: true,
      fetchJson: async (url: string) => {
        throw new Error("test must be updated to point at the official bundle path");
      },
      fetchBytes: async () => new Uint8Array(),
    };

    const langPython = await installBundle("lang-python", "0.1.0", { registry: registry as any, cache: cache as any, requireSignature: true });
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [langPython], cache: cache as any });
    const py = new PythonTool({ command });

    const out = await py.run({ code: "print(1+1)" } as any, { emitEvent: async () => {} } as any);
    expect(out.stdout).toContain("2");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/tools test -- --run python-wasi.integration`  
Expected: FAIL.

**Step 3: Minimal implementation**

- Provide a test registry that serves `packages/bundles/official/...` from the local filesystem (same pattern as demo-node’s `sampleRegistry`).
- Ensure `PythonTool` passes `argv: ["python", "-c", code]` and captures stdout correctly.

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/tools test -- --run python-wasi.integration`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/tools packages/bundles
git commit -m "test(tools): python wasi integration test"
git push
```

### Task 4: Update demos to use the real bundle version

**Files:**
- Modify: `packages/demo-node/src/runtime.ts`
- Modify: `packages/demo-web/src/agent.ts`
- Modify: `docs/guide/tools/python.md`

**Step 1: Update bundle version used in demos**

- Node demo sample install should use `lang-python@0.1.0` (or whatever version is produced).
- Browser demo should fetch the same version from the official bundles base URL.

**Step 2: Add a demo-web smoke test**

**Files:**
- Modify: `packages/demo-web/src/__tests__/wasi-bash.test.ts` (or add a new python test)

Add a minimal test ensuring the tool registry includes `Python` and that calling it produces stdout.

**Step 3: Run tests**

Run:

- `pnpm -C packages/demo-node test`
- `pnpm -C packages/demo-web test`

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/demo-node packages/demo-web docs/guide/tools/python.md
git commit -m "feat(demos): use real lang-python runtime bundle"
git push
```

