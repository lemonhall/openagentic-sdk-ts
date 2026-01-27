import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

function rootPath(rel: string): URL {
  return new URL(`../../../../${rel}`, import.meta.url);
}

async function readText(rel: string): Promise<string> {
  return readFile(rootPath(rel), "utf8");
}

describe("docs/guide", () => {
  it("is linked from the repo README and has quickstarts", async () => {
    const repoReadme = await readText("README.md");
    expect(repoReadme).toContain("docs/guide/README.md");

    const guideReadme = await readText("docs/guide/README.md");
    expect(guideReadme).toContain("quickstart-node.md");
    expect(guideReadme).toContain("quickstart-browser.md");
    expect(guideReadme).toContain("docs/guide/tools/README.md");

    const security = await readText("docs/guide/security.md");
    expect(security).toContain('credentials: "omit"');
    expect(security.toLowerCase()).toContain("shadow");

    const tools = await readText("docs/guide/tools/README.md");
    expect(tools).toContain("Bash");
    expect(tools).toContain("WebFetch");
  });
});
