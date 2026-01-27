import type { ModelProvider, SessionStore } from "@openagentic/sdk-core";
import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "@openagentic/sdk-core";
import { installBundle } from "@openagentic/bundles";
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
  WebSearchTool,
  WriteTool,
  WriteFileTool,
} from "@openagentic/tools";
import type { BundleCache, InstalledBundle, RegistryClient } from "@openagentic/bundles";
import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";
import { WasmtimeWasiRunner, createBubblewrapProcessSandbox } from "@openagentic/wasi-runner-wasmtime";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

export type CreateDemoRuntimeOptions = {
  sessionStore: SessionStore;
  workspace: Workspace;
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  maxSteps?: number;
  enableWasiBash?: boolean;
  wasiPreopenDir?: string;
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

function hasWasmtime(): boolean {
  try {
    execSync("command -v wasmtime", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasBwrap(bwrapPath: string): boolean {
  try {
    execSync(`command -v ${bwrapPath}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function demoProcessSandbox(): ReturnType<typeof createBubblewrapProcessSandbox> | undefined {
  const kind = process.env.OPENAGENTIC_PROCESS_SANDBOX;
  if (!kind) return undefined;

  const required = process.env.OPENAGENTIC_PROCESS_SANDBOX_REQUIRED === "1";
  if (kind !== "bwrap") {
    if (required) throw new Error(`demo-node: unsupported OPENAGENTIC_PROCESS_SANDBOX=${kind}`);
    console.warn(`demo-node: ignoring unsupported OPENAGENTIC_PROCESS_SANDBOX=${kind}`);
    return undefined;
  }

  if (process.platform !== "linux") {
    if (required) throw new Error("demo-node: Bubblewrap is Linux-only (OPENAGENTIC_PROCESS_SANDBOX_REQUIRED=1)");
    console.warn("demo-node: Bubblewrap is Linux-only; continuing without process sandbox");
    return undefined;
  }

  const bwrapPath = process.env.OPENAGENTIC_BWRAP_PATH || "bwrap";
  if (!hasBwrap(bwrapPath)) {
    if (required) throw new Error(`demo-node: bwrap not found in PATH (${bwrapPath})`);
    console.warn(`demo-node: bwrap not found (${bwrapPath}); continuing without process sandbox`);
    return undefined;
  }

  const network = (process.env.OPENAGENTIC_BWRAP_NETWORK || "allow") as "allow" | "deny";
  const roBinds = (process.env.OPENAGENTIC_BWRAP_RO_BINDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return createBubblewrapProcessSandbox({
    bwrapPath,
    network: network === "deny" ? "deny" : "allow",
    ...(roBinds.length ? { roBinds } : {}),
  });
}

function sampleRegistry(rootDir: string): RegistryClient {
  const baseUrl = "https://sample.local";
  const prefix = `${baseUrl}/`;
  return {
    baseUrl,
    isOfficial: true,
    async fetchJson(url: string): Promise<unknown> {
      if (!url.startsWith(prefix)) throw new Error(`demo-node: unexpected registry url: ${url}`);
      const rel = url.slice(prefix.length);
      const bytes = await readFile(join(rootDir, rel));
      return JSON.parse(bytes.toString("utf8")) as unknown;
    },
    async fetchBytes(url: string): Promise<Uint8Array> {
      if (!url.startsWith(prefix)) throw new Error(`demo-node: unexpected registry url: ${url}`);
      const rel = url.slice(prefix.length);
      return new Uint8Array(await readFile(join(rootDir, rel)));
    },
  };
}

async function installSampleCoreUtils(rootDir: string, cache: BundleCache): Promise<InstalledBundle> {
  return installBundle("core-utils", "0.0.0", { registry: sampleRegistry(rootDir), cache, requireSignature: true });
}

async function installSampleLangPython(rootDir: string, cache: BundleCache): Promise<InstalledBundle> {
  return installBundle("lang-python", "0.0.0", { registry: sampleRegistry(rootDir), cache, requireSignature: true });
}

export async function createDemoRuntime(options: CreateDemoRuntimeOptions): Promise<{
  runtime: AgentRuntime;
  tools: ToolRegistry;
  toolRunner: ToolRunner;
  permissionGate: AskOncePermissionGate;
}> {
  const enableWasiBash = options.enableWasiBash !== false;

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
  if (enableWasiBash) {
    const root = sampleBundleRoot();
    const cache = fileCache(root);
    const coreUtils = await installSampleCoreUtils(root, cache);
    const langPython = await installSampleLangPython(root, cache);
    const runner = hasWasmtime()
      ? new WasmtimeWasiRunner({ processSandbox: demoProcessSandbox() })
      : new InProcessWasiRunner();
    const command = new CommandTool({ runner, bundles: [coreUtils, langPython], cache });
    tools.register(new BashTool({ wasiCommand: command }));
    tools.register(new PythonTool({ command }));
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
    contextFactory: async (sessionId) => ({
      workspace: options.workspace,
      netFetch: enableWasiBash ? { policy: {} } : undefined,
      emitEvent: async (ev: any) => options.sessionStore.appendEvent(sessionId, ev),
      ...(options.wasiPreopenDir ? { wasi: { preopenDir: options.wasiPreopenDir } } : {}),
    }),
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
