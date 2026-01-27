import { describe, expect, it } from "vitest";

import { createWindowsJobObjectNativeRunner } from "../sandbox/windows-jobobject.js";

describe("windows jobobject backend (integration)", () => {
  const shouldRun = process.platform === "win32" && process.env.OPENAGENTIC_SANDBOX_INTEGRATION === "1";
  const maybeIt = shouldRun ? it : it.skip;

  maybeIt("kills a long-running process on timeout", async () => {
    const runner = createWindowsJobObjectNativeRunner({ timeoutMs: 200 });
    const result = await runner.exec({
      argv: ["node", "-e", "setTimeout(() => {}, 100000)"],
      limits: { timeoutMs: 50 },
    });

    expect(result.exitCode).toBe(124);
    expect(result.audits?.[0]?.timedOut).toBe(true);
  });
});

