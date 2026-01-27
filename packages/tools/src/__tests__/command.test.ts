import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { parseBundleManifest } from "@openagentic/bundles";
import { MemoryWorkspace } from "@openagentic/workspace";
import { CommandTool } from "../command.js";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("test.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
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

    const workspace = new MemoryWorkspace();
    const out = (await tool.run({ argv: ["echo"] }, { sessionId: "s", toolUseId: "t", workspace } as any)) as any;
    expect(out.stdout).toBe("hi\n");
  });

  it("mounts the workspace as WASI FS and commits changes back", async () => {
    const wasm = await compileWat(`
      (module
        (import "wasi_snapshot_preview1" "path_open" (func $path_open (param i32 i32 i32 i32 i32 i64 i64 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_close" (func $fd_close (param i32) (result i32)))
        (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
        (memory 1)
        (export "memory" (memory 0))
        (data (i32.const 300) "a.txt")
        (data (i32.const 320) "hello")
        (func (export "_start")
          (call $path_open
            (i32.const 3)        ;; dirfd
            (i32.const 0)        ;; dirflags
            (i32.const 300)      ;; path ptr
            (i32.const 5)        ;; path len
            (i32.const 9)        ;; oflags: CREAT|TRUNC
            (i64.const -1)       ;; rights base
            (i64.const -1)       ;; rights inheriting
            (i32.const 0)        ;; fdflags
            (i32.const 400)      ;; opened fd out
          )
          drop

          (i32.store (i32.const 8) (i32.const 320))
          (i32.store (i32.const 12) (i32.const 5))
          (call $fd_write (i32.load (i32.const 400)) (i32.const 8) (i32.const 1) (i32.const 120))
          drop
          (call $fd_close (i32.load (i32.const 400)))
          drop
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const manifest = parseBundleManifest({
      name: "test",
      version: "0.0.0",
      assets: [],
      commands: [{ name: "writefile", modulePath: "writefile.wasm" }],
    });
    const bundle: InstalledBundle = { manifest, rootPath: "bundles/test/0.0.0" };

    const cache: BundleCache = {
      async read(path) {
        if (path === "bundles/test/0.0.0/writefile.wasm") return wasm;
        return null;
      },
      async write() {
        throw new Error("not used in this test");
      },
    };

    const tool = new CommandTool({
      runner: new InProcessWasiRunner(),
      bundles: [bundle],
      cache,
    });

    const workspace = new MemoryWorkspace();
    const out = (await tool.run({ argv: ["writefile"] }, { sessionId: "s", toolUseId: "t", workspace } as any)) as any;
    expect(out.exitCode).toBe(0);

    const bytes = await workspace.readFile("a.txt");
    expect(new TextDecoder().decode(bytes)).toBe("hello");
  });

  it("can run ls from the sample core-utils bundle", async () => {
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

    const workspace = new MemoryWorkspace();
    await workspace.writeFile("a.txt", new TextEncoder().encode("a"));
    await workspace.writeFile("b.txt", new TextEncoder().encode("b"));

    const out = (await tool.run({ argv: ["ls"] }, { sessionId: "s", toolUseId: "t", workspace } as any)) as any;
    expect(out.stdout).toBe("a.txt\nb.txt\n");
  });
});
