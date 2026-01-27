# v6 Feature 01: Bubblewrap Native Runner (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Implement a Linux-only runner that executes host commands under Bubblewrap, mounting the shadow workspace as `/workspace`.

**Architecture:** `BubblewrapNativeRunner` implements `NativeRunner` by spawning `bwrap` and then the target host command. It bind-mounts the host shadow directory to `/workspace` and chdirs there. It enforces output caps and a timeout.

**Tech Stack:** Node `child_process.spawn`, Bubblewrap, Vitest.

### Task 1: Implement the runner (minimal)

**Files:**
- Create: `packages/native-runner/src/bubblewrap.ts`
- Modify: `packages/native-runner/src/index.ts` (export)
- Test: `packages/native-runner/src/__tests__/bubblewrap-argv.test.ts`

**Step 1: Write the failing test**

Create `packages/native-runner/src/__tests__/bubblewrap-argv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBubblewrapArgv } from "../bubblewrap.js";

describe("buildBubblewrapArgv", () => {
  it("mounts shadow workspace at /workspace and chdirs there", () => {
    const out = buildBubblewrapArgv({
      bwrapPath: "bwrap",
      shadowDir: "/host/shadow",
      commandArgv: ["bash", "-lc", "pwd"],
      network: "deny",
    });
    expect(out.cmd).toBe("bwrap");
    expect(out.args).toContain("--bind");
    expect(out.args).toContain("/host/shadow");
    expect(out.args).toContain("/workspace");
    expect(out.args).toContain("--chdir");
    expect(out.args).toContain("/workspace");
    expect(out.args).toContain("--unshare-net");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/native-runner test`  
Expected: FAIL because `bubblewrap.ts` does not exist.

**Step 3: Write minimal implementation**

Create `buildBubblewrapArgv(...)` producing:

- `--die-with-parent`, `--new-session`
- `--proc /proc`, `--dev /dev`, `--tmpfs /tmp`
- `--ro-bind` list (configurable; reasonable defaults)
- `--bind <shadowDir> /workspace` and `--chdir /workspace`
- optional `--unshare-net`
- then append `...commandArgv`

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/native-runner test`  
Expected: PASS.

### Task 2: Add an integration test (optional, skip-gated)

**Files:**
- Test: `packages/native-runner/src/__tests__/bubblewrap.integration.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BubblewrapNativeRunner } from "../bubblewrap.js";

function hasCmd(cmd: string): boolean {
  try {
    // eslint-disable-next-line no-sync
    require("node:child_process").execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("BubblewrapNativeRunner (integration)", () => {
  it.skipIf(process.platform !== "linux" || !hasCmd("bwrap") || !hasCmd("bash"))(
    "executes bash inside bwrap and writes only to shadow workspace",
    async () => {
      const shadow = await mkdtemp(join(tmpdir(), "oas-shadow-"));
      try {
        await writeFile(join(shadow, "in.txt"), "x\n", "utf8");
        const runner = new BubblewrapNativeRunner({ bwrapPath: "bwrap", shadowDir: shadow, network: "deny" });
        const res = await runner.exec({ argv: ["bash", "-lc", "cat in.txt > out.txt && echo ok"] });
        expect(res.exitCode).toBe(0);
        expect((await readFile(join(shadow, "out.txt"), "utf8")).trim()).toBe("x");
      } finally {
        await rm(shadow, { recursive: true, force: true });
      }
    },
  );
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/native-runner test`  
Expected: FAIL until `BubblewrapNativeRunner` exists.

**Step 3: Implement `BubblewrapNativeRunner.exec()`**

Minimal implementation:

- Build `bwrap` argv (using `buildBubblewrapArgv`)
- `spawn` with `stdio: ["pipe","pipe","pipe"]`
- enforce `timeoutMs` (kill process)
- enforce stdout/stderr caps
- return `NativeExecResult` + audits

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/native-runner test`  
Expected: PASS (or SKIP if deps missing).

**Step 5: Commit**

```bash
git add packages/native-runner
git commit -m "feat(native-runner): bubblewrap runner"
git push
```

