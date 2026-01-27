import { describe, expect, it } from "vitest";

import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { parseBundleManifest } from "@openagentic/bundles";
import { MemoryWorkspace } from "@openagentic/workspace";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

import { CommandTool } from "../command.js";

async function compileWat(wat: string): Promise<Uint8Array> {
  const wabt = await (await import("wabt")).default();
  const mod = wabt.parseWat("ls1.wat", wat);
  const { buffer } = mod.toBinary({ log: false, write_debug_names: true });
  return new Uint8Array(buffer);
}

describe("CommandTool + InProcessWasiRunner", () => {
  it("supports fd_readdir for simple ls", async () => {
    const wasm = await compileWat(`
      (module
        (import "wasi_snapshot_preview1" "fd_readdir" (func $fd_readdir (param i32 i32 i32 i64 i32) (result i32)))
        (import "wasi_snapshot_preview1" "fd_write" (func $fd_write (param i32 i32 i32 i32) (result i32)))
        (import "wasi_snapshot_preview1" "proc_exit" (func $proc_exit (param i32)))
        (memory 2)
        (export "memory" (memory 0))
        ;; newline at 64
        (data (i32.const 64) "\\n")
        (func (export "_start") (local $namelen i32)
          ;; fd_readdir(fd=3, buf=1024, len=4096, cookie=0, bufused_ptr=8)
          (call $fd_readdir (i32.const 3) (i32.const 1024) (i32.const 4096) (i64.const 0) (i32.const 8))
          drop
          ;; name length at dirent+16
          (local.set $namelen (i32.load (i32.add (i32.const 1024) (i32.const 16))))
          ;; iovec[0] = { ptr=name_ptr, len=namelen }
          (i32.store (i32.const 0) (i32.add (i32.const 1024) (i32.const 24)))
          (i32.store (i32.const 4) (local.get $namelen))
          (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 20))
          drop
          ;; write newline
          (i32.store (i32.const 0) (i32.const 64))
          (i32.store (i32.const 4) (i32.const 1))
          (call $fd_write (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 20))
          drop
          (call $proc_exit (i32.const 0))
        )
      )
    `);

    const manifest = parseBundleManifest({
      name: "test",
      version: "0.0.0",
      assets: [],
      commands: [{ name: "ls1", modulePath: "ls1.wasm" }],
    });
    const bundle: InstalledBundle = { manifest, rootPath: "bundles/test/0.0.0" };

    const cache: BundleCache = {
      async read(path) {
        if (path === "bundles/test/0.0.0/ls1.wasm") return wasm;
        return null;
      },
      async write() {
        throw new Error("not used");
      },
    };

    const workspace = new MemoryWorkspace();
    await workspace.writeFile("a.txt", new TextEncoder().encode("a"));
    await workspace.writeFile("b.txt", new TextEncoder().encode("b"));

    const tool = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [bundle], cache });
    const out = (await tool.run({ argv: ["ls1"] }, { sessionId: "s", toolUseId: "t", workspace } as any)) as any;
    expect(out.stdout).toBe("a.txt\n");
  });
});
