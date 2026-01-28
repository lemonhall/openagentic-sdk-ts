import type { ModelProvider, SessionStore } from "@openagentic/sdk-core";
import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "@openagentic/sdk-core";
import { OpenAIResponsesProvider } from "@openagentic/providers-openai";
import { createRegistryClient, installBundle } from "@openagentic/bundles";
import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import type { Workspace } from "@openagentic/workspace";
import {
  BashTool,
  CommandTool,
  EditTool,
  GlobTool,
  GrepTool,
  ListDirTool,
  PythonTool,
  ReadTool,
  ReadFileTool,
  SkillTool,
  SlashCommandTool,
  TodoWriteTool,
  WebFetchTool,
  WriteTool,
  WriteFileTool,
} from "@openagentic/tools";
import { InProcessWasiRunner, WorkerWasiRunner } from "@openagentic/wasi-runner-web";
import type { WasiRunner } from "@openagentic/wasi-runner";

import { createBrowserBundleCache } from "./bundle-cache.js";

export type CreateBrowserAgentOptions = {
  sessionStore: SessionStore;
  workspace: Workspace;
  provider?: ModelProvider;
  providerBaseUrl?: string;
  model: string;
  systemPrompt?: string;
  enableWasiBash?: boolean;
  enableWasiPython?: boolean;
  enableWasiNetFetch?: boolean;
  wasiBundleBaseUrl?: string;
  wasiPreopenDir?: string;
};

const sharedBundleCaches = new Map<string, BundleCache>();
function getSharedBundleCache(wasiBundleBaseUrl?: string): BundleCache {
  const base = String(wasiBundleBaseUrl ?? "");
  const existing = sharedBundleCaches.get(base);
  if (existing) return existing;
  const cache = createBrowserBundleCache({ base });
  sharedBundleCaches.set(base, cache);
  return cache;
}

const sharedInstalls = new Map<string, Promise<InstalledBundle>>();
async function installCoreUtilsBundle(options: { wasiBundleBaseUrl?: string; cache: BundleCache }): Promise<InstalledBundle> {
  const base = String(options.wasiBundleBaseUrl ?? "");
  const key = `${base}::core-utils@0.0.0`;
  const existing = sharedInstalls.get(key);
  if (existing) return existing;
  const p = (async () => {
    const registry = createRegistryClient(base, { isOfficial: true });
    return installBundle("core-utils", "0.0.0", { registry, cache: options.cache, requireSignature: true });
  })();
  sharedInstalls.set(key, p);
  return p;
}

async function installLangPythonBundle(options: { wasiBundleBaseUrl?: string; cache: BundleCache }): Promise<InstalledBundle> {
  const base = String(options.wasiBundleBaseUrl ?? "");
  const registry = createRegistryClient(base, { isOfficial: true });
  const versions = ["0.1.0", "0.0.0"];
  let lastErr: unknown = null;
  for (const version of versions) {
    try {
      const key = `${base}::lang-python@${version}`;
      const existing = sharedInstalls.get(key);
      if (existing) return await existing;

      const p = installBundle("lang-python", version, { registry, cache: options.cache, requireSignature: true });
      sharedInstalls.set(key, p);
      return await p;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const isNotFound = msg.includes("HTTP 404") || msg.includes("ENOENT");
      if (!isNotFound) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "failed to install lang-python bundle"));
}

let sharedWasiRunner: WasiRunner | null = null;
function getBrowserWasiRunner(): WasiRunner {
  if (sharedWasiRunner) return sharedWasiRunner;
  if (typeof Worker !== "undefined") {
    const w = new Worker(new URL("./wasi-worker.ts", import.meta.url), { type: "module" });
    sharedWasiRunner = new WorkerWasiRunner(w as any);
    return sharedWasiRunner;
  }
  sharedWasiRunner = new InProcessWasiRunner();
  return sharedWasiRunner;
}

export function resetBrowserWasiRunner(): void {
  const r: any = sharedWasiRunner as any;
  try {
    r?.terminate?.();
  } finally {
    sharedWasiRunner = null;
  }
}

export async function createBrowserAgent(options: CreateBrowserAgentOptions): Promise<{
  runtime: AgentRuntime;
  tools: ToolRegistry;
  toolRunner: ToolRunner;
}> {
  const tools = new ToolRegistry();
  tools.register(new ListDirTool());
  // Back-compat for older prompts/tests.
  tools.register(new ReadFileTool());
  tools.register(new WriteFileTool());
  tools.register(new ReadTool());
  tools.register(new WriteTool());
  tools.register(new EditTool());
  tools.register(new GlobTool());
  tools.register(new GrepTool());
  if (options.enableWasiBash) {
    const cache = getSharedBundleCache(options.wasiBundleBaseUrl);
    const coreUtils = await installCoreUtilsBundle({ wasiBundleBaseUrl: options.wasiBundleBaseUrl, cache });
    const bundles = [coreUtils];
    if (options.enableWasiPython) {
      bundles.push(await installLangPythonBundle({ wasiBundleBaseUrl: options.wasiBundleBaseUrl, cache }));
    }
    const command = new CommandTool({ runner: getBrowserWasiRunner(), bundles, cache });
    tools.register(new BashTool({ wasiCommand: command }));
    if (options.enableWasiPython) tools.register(new PythonTool({ command }));
  } else {
    tools.register(new BashTool());
  }
  tools.register(new WebFetchTool());
  tools.register(new TodoWriteTool());
  tools.register(new SlashCommandTool());
  tools.register(new SkillTool());

  const permissionGate = new AskOncePermissionGate({ approver: async () => true });
  const toolRunner = new ToolRunner({
    tools,
    permissionGate,
    sessionStore: options.sessionStore,
    contextFactory: async (sessionId) => ({
      workspace: options.workspace,
      netFetch: options.enableWasiNetFetch ? { policy: {} } : undefined,
      emitEvent: async (ev: any) => options.sessionStore.appendEvent(sessionId, ev),
      wasi:
        options.enableWasiBash && sharedWasiRunner instanceof WorkerWasiRunner
          ? {
              // In the browser, `preopenDir` is interpreted as the OPFS directory name for the mounted shadow workspace.
              preopenDir: (options.wasiPreopenDir ?? "openagentic-demo-web").trim() || "openagentic-demo-web",
            }
          : undefined,
    }),
  });

  const provider =
    options.provider ??
    new OpenAIResponsesProvider({
      baseUrl: (options.providerBaseUrl ?? "http://localhost:8787/v1").replace(/\/+$/, ""),
      requireApiKey: false,
    });

  const runtime = new AgentRuntime({
    sessionStore: options.sessionStore,
    toolRunner,
    tools,
    provider,
    model: options.model,
    apiKey: undefined,
    systemPrompt: options.systemPrompt,
  });

  return { runtime, tools, toolRunner };
}
