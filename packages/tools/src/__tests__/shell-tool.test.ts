import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseBundleManifest } from "@openagentic/bundles";
import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { MemoryWorkspace } from "@openagentic/workspace";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

import { CommandTool } from "../command.js";
import { ShellTool } from "../shell.js";

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

describe("ShellTool", () => {
  it("pipes echo into cat", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const cache = fileCache(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache });
    const shell = new ShellTool({ command });

    const ws = new MemoryWorkspace();
    const res = (await shell.run(
      { script: "echo hi | cat" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(res.stdout).toBe("hi\n");
  });

  it("supports ';' sequencing", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const cache = fileCache(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache });
    const shell = new ShellTool({ command });

    const ws = new MemoryWorkspace();
    const res = (await shell.run(
      { script: "echo a; echo b" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(res.stdout).toBe("a\nb\n");
  });

  it("pipes echo into grep", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const cache = fileCache(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache });
    const shell = new ShellTool({ command });

    const ws = new MemoryWorkspace();
    const res = (await shell.run(
      { script: "echo hi | grep hi" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(res.stdout).toBe("hi\n");
  });

  it("redirects stdout to a file", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });
    const shell = new ShellTool({ command });

    const ws = new MemoryWorkspace();
    const res = (await shell.run(
      { script: "echo hi > out.txt" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(res.stdout).toBe("");
    expect(new TextDecoder().decode(await ws.readFile("out.txt"))).toBe("hi\n");
  });

  it("supports && and || short-circuiting", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });
    const shell = new ShellTool({ command });
    const ws = new MemoryWorkspace();

    const a = (await shell.run(
      { script: "nope && echo hi" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(a.stdout).toBe("");

    const b = (await shell.run(
      { script: "nope || echo hi" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(b.stdout).toBe("hi\n");
  });

  it("expands $VAR in redirect paths and globs in input redirects", async () => {
    const root = sampleBundleRoot();
    const bundle = await loadCoreUtilsBundle(root);
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache: fileCache(root) });
    const shell = new ShellTool({ command });

    const ws = new MemoryWorkspace();
    await ws.writeFile("a1.txt", new TextEncoder().encode("X"));

    const out1 = (await shell.run(
      { script: "echo hi > $OUT", env: { OUT: "saved.txt" } },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(out1.stdout).toBe("");
    expect(new TextDecoder().decode(await ws.readFile("saved.txt"))).toBe("hi\n");

    const out2 = (await shell.run(
      { script: "cat < a*.txt" },
      { sessionId: "s", toolUseId: "t", workspace: ws } as any,
    )) as any;
    expect(out2.stdout).toBe("X");
  });
});
