import { describe, expect, it } from "vitest";

import { installBundle } from "@openagentic/bundles";
import type { BundleCache, RegistryClient } from "@openagentic/bundles";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";
import { MemoryWorkspace } from "@openagentic/workspace";

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CommandTool } from "../command.js";
import { PythonTool } from "../python/python.js";

function repoRootFromHere(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "..");
}

function bundlesRootDir(): string {
  const repoRoot = repoRootFromHere();
  const official = join(repoRoot, "packages", "bundles", "official");
  if (existsSync(join(official, "bundles"))) return official;
  return join(repoRoot, "packages", "bundles", "sample");
}

function fsRegistry(rootDir: string): RegistryClient {
  const baseUrl = "https://bundles.local";
  const prefix = `${baseUrl}/`;
  return {
    baseUrl,
    isOfficial: true,
    async fetchJson(url: string): Promise<unknown> {
      if (!url.startsWith(prefix)) throw new Error(`unexpected registry url: ${url}`);
      const rel = url.slice(prefix.length);
      const bytes = await readFile(join(rootDir, rel));
      return JSON.parse(bytes.toString("utf8")) as unknown;
    },
    async fetchBytes(url: string): Promise<Uint8Array> {
      if (!url.startsWith(prefix)) throw new Error(`unexpected registry url: ${url}`);
      const rel = url.slice(prefix.length);
      return new Uint8Array(await readFile(join(rootDir, rel)));
    },
  };
}

function memoryCache(): BundleCache {
  const m = new Map<string, Uint8Array>();
  return {
    async read(path) {
      return m.get(path) ?? null;
    },
    async write(path, data) {
      m.set(path, data);
    },
  };
}

describe("PythonTool (WASI integration)", () => {
  it("runs python -c print(1+1) via installed bundle", async () => {
    const rootDir = bundlesRootDir();
    const cache = memoryCache();
    const registry = fsRegistry(rootDir);

    const langPythonVersion = existsSync(join(rootDir, "bundles", "lang-python", "0.1.0", "manifest.json")) ? "0.1.0" : "0.0.0";
    const langPython = await installBundle("lang-python", langPythonVersion, { registry, cache, requireSignature: true });
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [langPython], cache });
    const py = new PythonTool({ command });

    const workspace = new MemoryWorkspace();
    const out = (await py.run({ code: "print(1+1)" }, { sessionId: "s", toolUseId: "t", workspace } as any)) as any;

    expect(out.exitCode).toBe(0);
    expect(out.stdout).toBe("2\n");

    const out2 = (await py.run({ code: 'print("hi")' }, { sessionId: "s", toolUseId: "t2", workspace } as any)) as any;
    expect(out2.exitCode).toBe(0);
    expect(out2.stdout).toBe("hi\n");
  });
});
