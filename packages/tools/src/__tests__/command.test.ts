import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { parseBundleManifest } from "@openagentic/bundles";
import { CommandTool } from "../command.js";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

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

describe("CommandTool", () => {
  it("runs a command from an installed bundle", async () => {
    const root = sampleBundleRoot();
    const manifestRaw = JSON.parse(
      await readFile(join(root, "bundles", "core-utils", "0.0.0", "manifest.json"), "utf8"),
    ) as unknown;
    const manifest = parseBundleManifest(manifestRaw);
    const bundle: InstalledBundle = { manifest, rootPath: "bundles/core-utils/0.0.0" };

    const tool = new CommandTool({
      runner: new InProcessWasiRunner(),
      bundles: [bundle],
      cache: fileCache(root),
    });

    const out = (await tool.run({ argv: ["echo"] }, { sessionId: "s", toolUseId: "t" })) as any;
    expect(out.stdout).toBe("hi\n");
  });
});

