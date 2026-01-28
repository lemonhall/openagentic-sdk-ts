import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { MemoryWorkspace } from "@openagentic/workspace";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";
import { parseBundleManifest } from "@openagentic/bundles";

import type { BundleCache, InstalledBundle } from "@openagentic/bundles";

import { BashTool } from "../bash/bash.js";
import { CommandTool } from "../command.js";

type FixtureExpectation = { exitCode: number; stdout: string; stderr: string };

function fixtureDir(): string {
  return join(process.cwd(), "src", "__tests__", "shell-compat");
}

function sampleBundleRoot(): string {
  return join(process.cwd(), "..", "bundles", "sample");
}

function fileCache(rootDir: string): BundleCache {
  return {
    async read(path) {
      try {
        const full = join(rootDir, path);
        return new Uint8Array(await readFile(full));
      } catch {
        return null;
      }
    },
    async write() {
      throw new Error("not used in this test");
    },
  };
}

async function loadCoreUtilsBundle(root: string): Promise<InstalledBundle> {
  const manifestRaw = JSON.parse(
    await readFile(join(root, "bundles", "core-utils", "0.0.0", "manifest.json"), "utf8"),
  ) as unknown;
  const manifest = parseBundleManifest(manifestRaw);
  return { manifest, rootPath: "bundles/core-utils/0.0.0" };
}

async function listFixtures(): Promise<string[]> {
  const entries = await readdir(fixtureDir(), { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".sh"))
    .map((e) => e.name)
    .sort();
}

async function loadFixture(name: string): Promise<{ script: string; expect: FixtureExpectation }> {
  const base = name.replace(/\.sh$/, "");
  const dir = fixtureDir();
  const script = await readFile(join(dir, name), "utf8");
  const stdout = await readFile(join(dir, `${base}.stdout`), "utf8").catch(() => "");
  const stderr = await readFile(join(dir, `${base}.stderr`), "utf8").catch(() => "");
  const exitCode = Number((await readFile(join(dir, `${base}.exitcode`), "utf8")).trim());
  return { script, expect: { exitCode, stdout, stderr } };
}

describe("Shell compat fixtures (v10)", () => {
  it("has at least one fixture", async () => {
    const names = await listFixtures();
    expect(names.length).toBeGreaterThan(0);
  });

  it("runs each fixture in both backends", async () => {
    const names = await listFixtures();
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });

    for (const name of names) {
      const fx = await loadFixture(name);

      for (const mode of ["native", "wasi"] as const) {
        const ws = new MemoryWorkspace();
        const bash = mode === "native" ? new BashTool() : new BashTool({ wasiCommand: command } as any);
        const out = (await bash.run(
          { command: fx.script, env: { SOURCE_DATE_EPOCH: "0", USER: "test" } },
          { sessionId: "s", toolUseId: `t:${mode}:${name}`, workspace: ws } as any,
        )) as any;

        expect(out.exit_code, `${mode}:${name}: exit_code`).toBe(fx.expect.exitCode);
        expect(out.stdout, `${mode}:${name}: stdout`).toBe(fx.expect.stdout);
        expect(out.stderr, `${mode}:${name}: stderr`).toBe(fx.expect.stderr);
      }
    }
  });
});
