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

export type CreateBrowserAgentOptions = {
  sessionStore: SessionStore;
  workspace: Workspace;
  provider?: ModelProvider;
  providerBaseUrl?: string;
  model: string;
  systemPrompt?: string;
  enableWasiBash?: boolean;
  wasiBundleBaseUrl?: string;
  wasiPreopenDir?: string;
};

function createBrowserBundleCache(): BundleCache {
  const mem = new Map<string, Uint8Array>();
  return {
    async read(path) {
      const key = String(path ?? "");
      return mem.get(key) ?? null;
    },
    async write(path, data) {
      const key = String(path ?? "");
      mem.set(key, data);
    },
  };
}

async function installCoreUtilsBundle(options: { wasiBundleBaseUrl?: string; cache: BundleCache }): Promise<InstalledBundle> {
  const registry = createRegistryClient(options.wasiBundleBaseUrl ?? "", { isOfficial: true });
  return installBundle("core-utils", "0.0.0", { registry, cache: options.cache, requireSignature: true });
}

async function installLangPythonBundle(options: { wasiBundleBaseUrl?: string; cache: BundleCache }): Promise<InstalledBundle> {
  const registry = createRegistryClient(options.wasiBundleBaseUrl ?? "", { isOfficial: true });
  return installBundle("lang-python", "0.0.0", { registry, cache: options.cache, requireSignature: true });
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
    const cache = createBrowserBundleCache();
    const coreUtils = await installCoreUtilsBundle({ wasiBundleBaseUrl: options.wasiBundleBaseUrl, cache });
    const langPython = await installLangPythonBundle({ wasiBundleBaseUrl: options.wasiBundleBaseUrl, cache });
    const command = new CommandTool({ runner: getBrowserWasiRunner(), bundles: [coreUtils, langPython], cache });
    tools.register(new BashTool({ wasiCommand: command }));
    tools.register(new PythonTool({ command }));
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
      netFetch: options.enableWasiBash ? { policy: {} } : undefined,
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
