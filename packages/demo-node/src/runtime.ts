import type { ModelProvider, SessionStore } from "@openagentic/sdk-core";
import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "@openagentic/sdk-core";
import { parseBundleManifest } from "@openagentic/bundles";
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
  WebSearchTool,
  WriteTool,
  WriteFileTool,
} from "@openagentic/tools";
import type { BundleCache, InstalledBundle } from "@openagentic/bundles";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type CreateDemoRuntimeOptions = {
  sessionStore: SessionStore;
  workspace: Workspace;
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  maxSteps?: number;
  enableWasiBash?: boolean;
};

function repoRootFromHere(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..");
}

function sampleBundleRoot(): string {
  return join(repoRootFromHere(), "packages", "bundles", "sample");
}

function fileCache(rootDir: string): BundleCache {
  return {
    async read(path) {
      try {
        const full = join(rootDir, path);
        return new Uint8Array(await readFile(full));
      } catch {
        return null;
      }
    },
    async write() {
      throw new Error("demo-node: fileCache.write not supported");
    },
  };
}

function sampleCoreUtilsBundle(): InstalledBundle {
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

export function createDemoRuntime(options: CreateDemoRuntimeOptions): {
  runtime: AgentRuntime;
  tools: ToolRegistry;
  toolRunner: ToolRunner;
  permissionGate: AskOncePermissionGate;
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
    const root = sampleBundleRoot();
    const command = new CommandTool({ runner: new InProcessWasiRunner(), bundles: [sampleCoreUtilsBundle()], cache: fileCache(root) });
    tools.register(new BashTool({ wasiCommand: command }));
  } else {
    tools.register(new BashTool());
  }
  tools.register(new WebFetchTool());
  tools.register(new WebSearchTool({ tavilyApiKey: process.env.TAVILY_API_KEY }));
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

  const runtime = new AgentRuntime({
    sessionStore: options.sessionStore,
    toolRunner,
    tools,
    provider: options.provider,
    model: options.model,
    apiKey: options.apiKey,
    systemPrompt: options.systemPrompt,
    maxSteps: options.maxSteps,
  });

  return { runtime, tools, toolRunner, permissionGate };
}
