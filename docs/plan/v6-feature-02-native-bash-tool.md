# v6 Feature 02: Native `Bash` Tool (Implementation Plan)

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.  
> **Goal:** Provide a server-only `Bash` tool implementation backed by the native runner (host `/bin/bash`) so pipelines/redirection behave like real bash.

**Architecture:** Add a `NativeBashTool` (or extend existing `BashTool` with an engine option) that runs:

- `bash -lc <command>`

inside the shadow workspace via `NativeRunner` (Bubblewrap runner in production).

**Tech Stack:** TypeScript, Node, Vitest.

### Task 1: Implement the tool

**Files:**
- Create: `packages/tools/src/bash/bash-native.ts`
- Modify: `packages/tools/src/index.ts` (export)
- Test: `packages/tools/src/__tests__/bash-native.test.ts`

**Step 1: Write the failing test**

Create `packages/tools/src/__tests__/bash-native.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NativeBashTool } from "../bash/bash-native.js";

describe("NativeBashTool", () => {
  it("executes bash -lc via NativeRunner", async () => {
    const calls: any[] = [];
    const tool = new NativeBashTool({
      runner: {
        exec: async (input) => {
          calls.push(input);
          return { exitCode: 0, stdout: new TextEncoder().encode("hi\n"), stderr: new Uint8Array(), truncatedStdout: false, truncatedStderr: false };
        },
      },
    } as any);

    const out: any = await tool.run({ command: "echo hi" }, { sessionId: "s", toolUseId: "t", workspace: {} } as any);
    expect(calls[0].argv.slice(0, 2)).toEqual(["bash", "-lc"]);
    expect(out.exit_code).toBe(0);
    expect(out.stdout).toContain("hi");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C packages/tools test`  
Expected: FAIL because `NativeBashTool` does not exist.

**Step 3: Write minimal implementation**

Implement `NativeBashTool`:

- same input schema as `Bash` (`command`, optional `cwd`, optional `env`)
- maps to runner.exec({ argv: ["bash","-lc",command], cwd, env, stdin, limits })
- returns the same shaped output object as existing `BashTool` (stdout/stderr/exit_code etc.)

**Step 4: Run test to verify it passes**

Run: `pnpm -C packages/tools test`  
Expected: PASS.

**Step 5: Commit**

```bash
git add packages/tools
git commit -m "feat(tools): native bash tool"
git push
```

