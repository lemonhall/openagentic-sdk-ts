import { describe, expect, it } from "vitest";

import { MemoryWorkspace } from "@openagentic/workspace";

import { execSequence } from "../exec.js";
import { parseScript } from "../parser.js";

describe("shell execution controls (v11)", () => {
  it("supports exit [code] and stops the script", async () => {
    const ws = new MemoryWorkspace();
    const ast = parseScript("exit 7; echo after");

    const res = await execSequence(ast, { env: {}, cwd: "" }, {
      workspace: ws,
      runCommand: async (argv) => {
        throw new Error(`unknown command: ${argv[0] ?? ""}`);
      },
    });

    expect(res.exitCode).toBe(7);
    expect(res.stdout).toBe("");
    expect(res.stderr).toBe("");
  });
});

