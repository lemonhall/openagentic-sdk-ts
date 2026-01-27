import type { ModelProvider, SessionStore } from "@openagentic/sdk-core";
import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "@openagentic/sdk-core";
import type { Workspace } from "@openagentic/workspace";
import {
  BashTool,
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

export type CreateDemoRuntimeOptions = {
  sessionStore: SessionStore;
  workspace: Workspace;
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  maxSteps?: number;
};

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
  tools.register(new BashTool());
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
