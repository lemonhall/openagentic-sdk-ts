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

