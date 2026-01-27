import { describe, expect, it } from "vitest";

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MemoryWorkspace } from "@openagentic/workspace";

import * as shadowMod from "../workspace-shadow.js";

describe("demo-node shadow workspace", () => {
  it("imports from real dir into shadow and only writes back on commit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openagentic-demo-node-"));
    const realPath = join(dir, "a.txt");
    await writeFile(realPath, "one\n");

    const shadow = new MemoryWorkspace();

    const importLocalDirToShadow = (shadowMod as any).importLocalDirToShadow as
      | ((opts: { realDir: string; shadow: MemoryWorkspace }) => Promise<{ baseSnapshot: unknown }>)
      | undefined;
    const commitShadowToLocalDir = (shadowMod as any).commitShadowToLocalDir as
      | ((opts: { realDir: string; shadow: MemoryWorkspace; baseSnapshot: unknown }) => Promise<void>)
      | undefined;

    expect(typeof importLocalDirToShadow).toBe("function");
    expect(typeof commitShadowToLocalDir).toBe("function");
    if (typeof importLocalDirToShadow !== "function" || typeof commitShadowToLocalDir !== "function") return;

    const { baseSnapshot } = await importLocalDirToShadow({ realDir: dir, shadow });

    // Modify in shadow.
    await shadow.writeFile("a.txt", new TextEncoder().encode("two\n"));

    // Real FS unchanged until commit.
    expect((await readFile(realPath, "utf8")).toString()).toBe("one\n");

    await commitShadowToLocalDir({ realDir: dir, shadow, baseSnapshot });

    expect((await readFile(realPath, "utf8")).toString()).toBe("two\n");
  });
});

