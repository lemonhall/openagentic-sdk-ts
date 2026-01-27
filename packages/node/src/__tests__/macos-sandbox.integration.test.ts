import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { buildSandboxExecProfile } from "../sandbox/macos-sandbox-exec.js";

function hasCmd(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("macos sandbox-exec sandbox (integration)", () => {
  const shouldRun =
    process.platform === "darwin" && hasCmd("sandbox-exec") && process.env.OPENAGENTIC_SANDBOX_INTEGRATION === "1";

  const maybeIt = shouldRun ? it : it.skip;

  maybeIt("can write into the shadow dir and denies unrelated paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "oas-sandbox-exec-"));
    const shadow = join(root, "shadow");
    try {
      await mkdir(shadow, { recursive: true });
      const profile = buildSandboxExecProfile({ shadowDirHostPath: shadow, network: "deny" });

      const run = async (argv: string[], cwd?: string): Promise<number> =>
        new Promise((resolve, reject) => {
          const cp = spawn(argv[0]!, argv.slice(1), { stdio: ["ignore", "pipe", "pipe"], cwd, env: process.env });
          cp.on("error", reject);
          cp.on("close", (code) => resolve(code ?? 0));
        });

      const writeCode = await run(["sandbox-exec", "-p", profile, "--", "bash", "-lc", "echo hello > out.txt"], shadow);
      expect(writeCode).toBe(0);
      expect((await readFile(join(shadow, "out.txt"), "utf8")).trim()).toBe("hello");

      const denyCode = await run(["sandbox-exec", "-p", profile, "--", "bash", "-lc", "ls /Users"], shadow);
      expect(denyCode).not.toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

