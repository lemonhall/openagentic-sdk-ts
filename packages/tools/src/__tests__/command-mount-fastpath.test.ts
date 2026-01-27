import { describe, expect, it } from "vitest";

import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { parseBundleManifest } from "@openagentic/bundles";
import type { WasiExecInput, WasiExecResult, WasiRunner } from "@openagentic/wasi-runner";
import type { Workspace, WorkspaceEntry, WorkspaceStat } from "@openagentic/workspace";

import { CommandTool } from "../command.js";

class ThrowingWorkspace implements Workspace {
  async readFile(): Promise<Uint8Array> {
    throw new Error("readFile should not be called");
  }
  async writeFile(): Promise<void> {
    throw new Error("writeFile should not be called");
  }
  async deleteFile(): Promise<void> {
    throw new Error("deleteFile should not be called");
  }
  async stat(): Promise<WorkspaceStat | null> {
    throw new Error("stat should not be called");
  }
  async listDir(): Promise<WorkspaceEntry[]> {
    throw new Error("listDir should not be called");
  }
}

describe("CommandTool (preopenDir fast path)", () => {
  it("skips workspace snapshotting and passes preopenDir to runner", async () => {
    let seen: WasiExecInput | null = null;
    const runner: WasiRunner = {
      async execModule(input: WasiExecInput): Promise<WasiExecResult> {
        seen = input;
        return {
          exitCode: 0,
          stdout: new TextEncoder().encode("ok\n"),
          stderr: new Uint8Array(),
          truncatedStdout: false,
          truncatedStderr: false,
        };
      },
    };

    const manifest = parseBundleManifest({
      name: "test",
      version: "0.0.0",
      assets: [],
      commands: [{ name: "echo", modulePath: "echo.wasm" }],
    });
    const bundle: InstalledBundle = { manifest, rootPath: "bundles/test/0.0.0" };

    const cache: BundleCache = {
      async read(path: string) {
        if (path === "bundles/test/0.0.0/echo.wasm") return new Uint8Array([0x00]);
        return null;
      },
      async write() {
        throw new Error("not used");
      },
    };

    const tool = new CommandTool({ runner, bundles: [bundle], cache });
    const out = (await tool.run(
      { argv: ["echo"] },
      { sessionId: "s", toolUseId: "t", workspace: new ThrowingWorkspace(), wasi: { preopenDir: "/shadow" } } as any,
    )) as any;

    expect(out.stdout).toBe("ok\n");
    expect(seen?.preopenDir).toBe("/shadow");
    expect(seen?.fs).toBeUndefined();
  });
});

