import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { parseBundleManifest } from "@openagentic/bundles";
import { MemoryWorkspace } from "@openagentic/workspace";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

import { BashTool } from "../bash/bash.js";
import { CommandTool } from "../command.js";

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

describe("BashTool (workspace-native)", () => {
  it("supports pipes + grep over workspace files", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("a.txt", new TextEncoder().encode("one\ntwo\nthree\n"));

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "cat a.txt | grep tw" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("two\n");
    expect(out.stderr).toBe("");
  });

  it("supports redirects to files", async () => {
    const ws = new MemoryWorkspace();
    const bash = new BashTool();

    const out = (await bash.run(
      { command: "echo hi > out.txt" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("");
    expect(new TextDecoder().decode(await ws.readFile("out.txt"))).toBe("hi\n");
  });

  it("supports cd + ls with &&", async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile("src/a.txt", new TextEncoder().encode("x"));

    const bash = new BashTool();
    const out = (await bash.run(
      { command: "cd src && ls" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout.trim().split(/\\s+/).sort()).toEqual(["a.txt"]);
  });
});

describe("BashTool (WASI backend)", () => {
  it("supports pipes via core-utils bundle", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });

    const ws = new MemoryWorkspace();
    const bash = new BashTool({ wasiCommand: command } as any);
    const out = (await bash.run(
      { command: "echo hi | grep hi" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;

    expect(out.exit_code).toBe(0);
    expect(out.stdout).toBe("hi\n");
  });
});
