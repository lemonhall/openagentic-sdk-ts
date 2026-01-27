# v6 Feature 00: Native Runner Contract (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Introduce a server-only “native execution engine” contract to run host commands (optionally under a sandbox), without any WASI modules or bundles.

**Architecture:** Add a minimal `NativeRunner` interface (like `WasiRunner`, but for spawning host processes). Keep it separate from WASI types to avoid conflating engines.

**Tech Stack:** TypeScript, Node `child_process.spawn`, Vitest.

### Task 1: Define the contract + types

**Files:**
- Create: `packages/native-runner/src/types.ts`
- Create: `packages/native-runner/src/index.ts`
- Create: `packages/native-runner/package.json`
- Create: `packages/native-runner/tsconfig.build.json` (follow existing package patterns)
- Test: `packages/native-runner/src/__tests__/contract.test.ts`

**Step 1: Write the failing test**

Create `packages/native-runner/src/__tests__/contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { NativeExecInput, NativeExecResult, NativeRunner } from "../types.js";

describe("NativeRunner contract", () => {
  it("is structurally usable by tools", () => {
    const runner: NativeRunner = {
      exec: async (_input: NativeExecInput): Promise<NativeExecResult> => ({
        exitCode: 0,
        stdout: new Uint8Array(),
        stderr: new Uint8Array(),
        truncatedStdout: false,
        truncatedStderr: false,
      }),
    };
    expect(typeof runner.exec).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/native-runner test`  
Expected: FAIL because package/files don’t exist yet.

**Step 3: Write minimal implementation**

Create `packages/native-runner/src/types.ts` with:

- `NativeLimits` (`maxStdoutBytes`, `maxStderrBytes`, `timeoutMs`)
- `NativeExecInput` (`argv: string[]`, `cwd?: string`, `env?: Record<string,string>`, `stdin?: Uint8Array`, `limits?: NativeLimits`)
- `NativeExecResult` (`exitCode`, `stdout`, `stderr`, `truncatedStdout`, `truncatedStderr`, `audits?: NativeAuditRecord[]`)
- `NativeAuditRecord` (at minimum: `kind`, `cmd`, `argv`, `cwd`, `durationMs`, `timedOut`, `signal?`)
- `NativeRunner` interface: `exec(input): Promise<NativeExecResult>`

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/native-runner test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/native-runner
git commit -m "feat(native-runner): add contract"
git push
```

