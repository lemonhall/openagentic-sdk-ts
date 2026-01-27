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
    await writeFile(join(dir, ".openagentic", "should-not-import.txt"), "nope\n").catch(async () => {
      // Ensure directory exists across platforms.
      await (await import("node:fs/promises")).mkdir(join(dir, ".openagentic"), { recursive: true });
      await writeFile(join(dir, ".openagentic", "should-not-import.txt"), "nope\n");
    });

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

    // Internal metadata should not be imported.
    await expect(shadow.readFile(".openagentic/should-not-import.txt")).rejects.toThrow();

    // Modify in shadow.
    await shadow.writeFile("a.txt", new TextEncoder().encode("two\n"));
    await shadow.writeFile(".openagentic/should-not-commit.txt", new TextEncoder().encode("nope\n"));

    // Real FS unchanged until commit.
    expect((await readFile(realPath, "utf8")).toString()).toBe("one\n");

    await commitShadowToLocalDir({ realDir: dir, shadow, baseSnapshot });

    expect((await readFile(realPath, "utf8")).toString()).toBe("two\n");
    await expect(readFile(join(dir, ".openagentic", "should-not-commit.txt"), "utf8")).rejects.toThrow();
  });
});
