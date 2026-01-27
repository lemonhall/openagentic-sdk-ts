import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { createNsjailProcessSandbox } from "../sandbox/linux-nsjail.js";

function hasCmd(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("linux nsjail sandbox (integration)", () => {
  const shouldRun =
    process.platform === "linux" && hasCmd("nsjail") && process.env.OPENAGENTIC_SANDBOX_INTEGRATION === "1";

  const maybeIt = shouldRun ? it : it.skip;

  maybeIt("can write into the shadow dir via /workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "oas-nsjail-"));
    const shadow = join(root, "shadow");
    const outPath = join(shadow, "out.txt");

    try {
      await mkdir(shadow, { recursive: true });

      const sandbox = createNsjailProcessSandbox({ nsjailPath: "nsjail", network: "deny" });
      const wrapped = sandbox.wrap({
        cmd: "bash",
        args: ["-lc", "echo hello > /workspace/out.txt"],
        env: { ...process.env },
        mounts: [{ kind: "dir", label: "shadow-workspace", hostPath: shadow, guestPath: "/workspace", mode: "rw" }],
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        const cp = spawn(wrapped.cmd, wrapped.args, { stdio: ["ignore", "pipe", "pipe"], env: wrapped.env });
        cp.on("error", reject);
        cp.on("close", (code) => resolve(code ?? 0));
      });
      expect(exitCode).toBe(0);

      const out = await readFile(outPath, "utf8");
      expect(out.trim()).toBe("hello");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
