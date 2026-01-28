import { describe, expect, it } from "vitest";

import { JsonlSessionStore } from "@openagentic/sdk-core";
import { MemoryWorkspace } from "@openagentic/workspace";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createBrowserAgent } from "../agent.js";

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

describe("demo-web WASI Python", () => {
  it("can run python -c print(1+1) via WASI bundle", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : String(input?.url ?? "");
      if (init?.credentials !== "omit") throw new Error("expected credentials=omit");
      const u = new URL(url);
      const full = join(process.cwd(), "public", u.pathname);
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

      const py = agent.tools.get("Python");
      const out = (await py.run({ code: "print(1+1)" }, { sessionId: "s", toolUseId: "t", workspace } as any)) as any;
      expect(out.exitCode).toBe(0);
      expect(out.stdout).toBe("2\n");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

