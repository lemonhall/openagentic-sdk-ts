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

    const plansIndex = await readText("docs/plan/index.md");
    expect(plansIndex).toContain("v8 index");
    expect(plansIndex).toContain("v8-index.md");
    expect(plansIndex).toContain("v9 index");
    expect(plansIndex).toContain("v9-index.md");

    const v9Index = await readText("docs/plan/v9-index.md");
    expect(v9Index).toContain("v9 Plans Index");

    const vision = await readText("docs/plan/2026-01-27-vision-and-core-design.md");
    expect(vision).toContain("Status (as of v8");

    const guideReadme = await readText("docs/guide/README.md");
    expect(guideReadme).toContain("quickstart-node.md");
    expect(guideReadme).toContain("quickstart-browser.md");
    expect(guideReadme).toContain("docs/guide/tools/README.md");

    const quickNode = await readText("docs/guide/quickstart-node.md");
    expect(quickNode).toContain("--no-wasi");
    expect(quickNode).toContain("OPENAI_BASE_URL");
    expect(quickNode).toContain("--wasi-python");

    const quickBrowser = await readText("docs/guide/quickstart-browser.md");
    expect(quickBrowser.toLowerCase()).toContain("bundles base url");
    expect(quickBrowser).toContain("/bundles/");

    const security = await readText("docs/guide/security.md");
    expect(security).toContain('credentials: "omit"');
    expect(security.toLowerCase()).toContain("shadow");

    const tools = await readText("docs/guide/tools/README.md");
    expect(tools).toContain("Bash");
    expect(tools).toContain("WebFetch");

    const pythonTool = await readText("docs/guide/tools/python.md");
    expect(pythonTool).toContain("--wasi-python");

    const toolsOverview = await readText("docs/guide/tools.md");
    expect(toolsOverview).not.toContain("The demos do not enable them by default");

    const sandboxing = await readText("docs/guide/sandboxing.md");
    expect(sandboxing).toContain("netFetch");
    expect(sandboxing).toContain("wasmtime");
    expect(sandboxing.toLowerCase()).toContain("not supported");
  });
});
