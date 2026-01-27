import type { ModelProvider, SessionStore } from "@openagentic/sdk-core";
import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "@openagentic/sdk-core";
import { OpenAIResponsesProvider } from "@openagentic/providers-openai";
import { parseBundleManifest } from "@openagentic/bundles";
import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import type { Workspace } from "@openagentic/workspace";
import {
  BashTool,
  CommandTool,
  EditTool,
  GlobTool,
  GrepTool,
  ListDirTool,
  ReadTool,
  ReadFileTool,
  SkillTool,
  SlashCommandTool,
  TodoWriteTool,
  WebFetchTool,
  WriteTool,
  WriteFileTool,
} from "@openagentic/tools";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";

export type CreateBrowserAgentOptions = {
  sessionStore: SessionStore;
  workspace: Workspace;
  provider?: ModelProvider;
  providerBaseUrl?: string;
  model: string;
  systemPrompt?: string;
  enableWasiBash?: boolean;
  wasiBundleBaseUrl?: string;
};

function joinUrl(baseUrl: string, path: string): string {
  const b = (baseUrl ?? "").replace(/\/+$/, "");
  const p = String(path ?? "").replace(/^\/+/, "");
  if (!b) return `/${p}`;
  return `${b}/${p}`;
}

function createBrowserBundleCache(options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): BundleCache {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("demo-web: fetch is required for WASI bundle cache");

  const mem = new Map<string, Uint8Array>();
  return {
    async read(path) {
      const key = String(path ?? "");
      const hit = mem.get(key);
      if (hit) return hit;
      const res = await fetchImpl(joinUrl(baseUrl, key), { credentials: "omit" });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      mem.set(key, bytes);
      return bytes;
    },
    async write() {
      throw new Error("demo-web: bundle cache is read-only");
    },
  };
}

function coreUtilsBundle(): InstalledBundle {
  const manifest = parseBundleManifest({
    name: "core-utils",
    version: "0.0.0",
    assets: [],
    commands: [
      { name: "echo", modulePath: "echo.wasm" },
      { name: "cat", modulePath: "cat.wasm" },
      { name: "grep", modulePath: "grep.wasm" },
    ],
  });
  return { manifest, rootPath: "bundles/core-utils/0.0.0" };
}

export function createBrowserAgent(options: CreateBrowserAgentOptions): {
  runtime: AgentRuntime;
  tools: ToolRegistry;
  toolRunner: ToolRunner;
} {
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
    const cache = createBrowserBundleCache({ baseUrl: options.wasiBundleBaseUrl });
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [coreUtilsBundle()], cache });
    tools.register(new BashTool({ wasiCommand: command }));
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
    contextFactory: async () => ({ workspace: options.workspace }),
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
