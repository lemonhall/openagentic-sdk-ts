import { describe, expect, it } from "vitest";

import { JsonlSessionStore } from "@openagentic/sdk-core";
import { MemoryWorkspace } from "@openagentic/workspace";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createBrowserAgent } from "../agent.js";

function repoRootFromHere(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "..");
}

function bundlesRootFromRepo(): string {
  return join(repoRootFromHere(), "packages", "bundles", "official");
}

class MemoryJsonlBackend {
  #files = new Map<string, string>();
  async mkdirp(_dir: string): Promise<void> {}
  async readText(path: string): Promise<string> {
    const v = this.#files.get(path);
    if (v == null) throw new Error("ENOENT");
    return v;
  }
  async writeText(path: string, text: string): Promise<void> {
    this.#files.set(path, text);
  }
  async appendText(path: string, text: string): Promise<void> {
    this.#files.set(path, (this.#files.get(path) ?? "") + text);
  }
}

class FakeProvider {
  async complete(): Promise<{ assistantText: string | null; toolCalls: any[] }> {
    return { assistantText: "ok", toolCalls: [] };
  }
}

describe("demo-web WASI rg", () => {
  it("runs rg --version via WASI bundle", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : String(input?.url ?? "");
      if (init?.credentials !== "omit") throw new Error("expected credentials=omit");
      const u = new URL(url);
      const full = join(bundlesRootFromRepo(), u.pathname);
      const bytes = await readFile(full);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        text: async () => bytes.toString("utf8"),
      } as any;
    }) as any;

    const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);
    const workspace = new MemoryWorkspace();

    try {
      const agent = await createBrowserAgent({
        sessionStore,
        workspace,
        provider: new FakeProvider() as any,
        model: "fake-model",
        enableWasiBash: true,
        wasiBundleBaseUrl: "http://local",
      } as any);

      const bash = agent.tools.get("Bash");
      const out = (await bash.run(
        { command: "rg --version" },
        { sessionId: "s", toolUseId: "t", workspace } as any,
      )) as any;

      expect(out.exit_code).toBe(0);
      expect(String(out.stdout)).toContain("ripgrep 15.1.0");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
