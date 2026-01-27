import { describe, expect, it } from "vitest";

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../index.js";

describe("demo-node CLI (base url)", () => {
  it("uses OPENAI_BASE_URL when constructing the default OpenAI provider", async () => {
    const projectDir = await mkdtemp(join(tmpdir(), "openagentic-demo-node-baseurl-"));

    const calls: any[] = [];
    const fetchImpl: typeof fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: "r1",
          output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ) as any;
    }) as any;

    const oldKey = process.env.OPENAI_API_KEY;
    const oldBase = process.env.OPENAI_BASE_URL;
    process.env.OPENAI_API_KEY = "k";
    process.env.OPENAI_BASE_URL = "https://example.com/custom/v1";
    try {
      const res = await runCli(["--project", projectDir, "--once", "hi"], {
        fetchImpl,
        stdout: { write: () => {} },
      } as any);
      expect(res.exitCode).toBe(0);
    } finally {
      if (oldKey == null) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldKey;
      if (oldBase == null) delete process.env.OPENAI_BASE_URL;
      else process.env.OPENAI_BASE_URL = oldBase;
    }

    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toBe("https://example.com/custom/v1/responses");
  });
});

