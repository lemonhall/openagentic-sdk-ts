import type { ModelProvider, SessionStore } from "@openagentic/sdk-core";
import { AgentRuntime, AskOncePermissionGate, ToolRegistry, ToolRunner } from "@openagentic/sdk-core";
import { OpenAIResponsesProvider } from "@openagentic/providers-openai";
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
  WriteTool,
  WriteFileTool,
} from "@openagentic/tools";

export type CreateBrowserAgentOptions = {
  sessionStore: SessionStore;
  workspace: Workspace;
  provider?: ModelProvider;
  providerBaseUrl?: string;
  model: string;
  systemPrompt?: string;
};

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
  tools.register(new BashTool());
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
