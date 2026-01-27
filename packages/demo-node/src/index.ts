export type RunCliResult = {
  exitCode: number;
  sessionId?: string;
};

export type RunCliDeps = {
  stdout?: { write: (s: string) => void };
  stderr?: { write: (s: string) => void };
  provider?: import("@openagentic/sdk-core").ModelProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  systemPrompt?: string;
  sessionStore?: import("@openagentic/sdk-core").SessionStore;
  workspace?: import("@openagentic/workspace").Workspace;
  lines?: Iterable<string> | AsyncIterable<string>;
};

import type { ModelProvider, SessionStore } from "@openagentic/sdk-core";
import { JsonlSessionStore } from "@openagentic/sdk-core";
import { OpenAIResponsesProvider } from "@openagentic/providers-openai";
import { createNodeJsonlBackend } from "@openagentic/sdk-node";
import { MemoryWorkspace } from "@openagentic/workspace";
import type { Workspace } from "@openagentic/workspace";
import type { Snapshot } from "@openagentic/workspace";
import { computeChangeSet, snapshotWorkspace } from "@openagentic/workspace";
import { join } from "node:path";

import { createDemoRuntime } from "./runtime.js";
import { createCliRenderer } from "./render.js";
import { commitShadowToLocalDir, importLocalDirToShadow } from "./workspace-shadow.js";
import { createInterface } from "node:readline";

function getFlagValue(argv: string[], flag: string): string | null {
  const i = argv.indexOf(flag);
  if (i < 0) return null;
  const v = argv[i + 1];
  return typeof v === "string" ? v : null;
}

export async function runCli(argv: string[], deps: RunCliDeps = {}): Promise<RunCliResult> {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;

  const baseUrlFlag = getFlagValue(argv, "--base-url");
  const projectDir = getFlagValue(argv, "--project");
  const once = getFlagValue(argv, "--once");
  if (once != null) {
    const injectedProvider = deps.provider as ModelProvider | undefined;
    const baseUrl = deps.baseUrl ?? baseUrlFlag ?? process.env.OPENAI_BASE_URL;
    const fetchImpl = deps.fetchImpl;
    const provider =
      injectedProvider ??
      new OpenAIResponsesProvider({
        ...(baseUrl ? { baseUrl } : {}),
        ...(fetchImpl ? { fetchImpl } : {}),
      });
    const model = deps.model ?? "gpt-4o-mini";
    const apiKey = deps.apiKey ?? process.env.OPENAI_API_KEY;
    let sessionStore = deps.sessionStore as SessionStore | undefined;
    let workspace = deps.workspace as Workspace | undefined;

    if (!injectedProvider && !apiKey) {
      throw new Error("runCli: OPENAI_API_KEY is required (or pass deps.provider + deps.apiKey)");
    }

    if (!sessionStore) {
      if (!projectDir) throw new Error("runCli: sessionStore is required (pass deps.sessionStore) or provide --project");
      sessionStore = new JsonlSessionStore(createNodeJsonlBackend(join(projectDir, ".openagentic", "sessions")));
    }

    if (!workspace) {
      if (!projectDir) throw new Error("runCli: workspace is required (pass deps.workspace) or provide --project");
      const shadow = new MemoryWorkspace();
      await importLocalDirToShadow({ realDir: projectDir, shadow });
      workspace = shadow;
    }

    const { runtime } = createDemoRuntime({
      sessionStore,
      workspace,
      provider,
      model,
      apiKey,
      systemPrompt: deps.systemPrompt,
    });

    const renderer = createCliRenderer(stdout);
    let sessionId: string | undefined;
    for await (const ev of runtime.runTurn({ userText: once })) {
      renderer.onEvent(ev);
      if (ev.type === "system.init") sessionId = (ev as any).sessionId;
    }
    return { exitCode: 0, sessionId };
  }

  const injectedProvider = deps.provider as ModelProvider | undefined;
  const baseUrl = deps.baseUrl ?? baseUrlFlag ?? process.env.OPENAI_BASE_URL;
  const fetchImpl = deps.fetchImpl;
  const provider =
    injectedProvider ??
    new OpenAIResponsesProvider({
      ...(baseUrl ? { baseUrl } : {}),
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  const model = deps.model ?? "gpt-4o-mini";
  const apiKey = deps.apiKey ?? process.env.OPENAI_API_KEY;
  let sessionStore = deps.sessionStore as SessionStore | undefined;
  let workspace = deps.workspace as Workspace | undefined;
  let shadowForCommit: MemoryWorkspace | null = null;
  let baseSnapshot: Snapshot | null = null;

  if (!injectedProvider && !apiKey) {
    throw new Error("runCli: OPENAI_API_KEY is required (or pass deps.provider + deps.apiKey)");
  }

  if (!sessionStore) {
    if (!projectDir) throw new Error("runCli: sessionStore is required (pass deps.sessionStore) or provide --project");
    sessionStore = new JsonlSessionStore(createNodeJsonlBackend(join(projectDir, ".openagentic", "sessions")));
  }

  if (!workspace) {
    if (!projectDir) throw new Error("runCli: workspace is required (pass deps.workspace) or provide --project");
    const shadow = new MemoryWorkspace();
    const imported = await importLocalDirToShadow({ realDir: projectDir, shadow });
    workspace = shadow;
    // Only available when we created the shadow from a real project directory.
    shadowForCommit = shadow;
    baseSnapshot = imported.baseSnapshot;
  }

  const { runtime } = createDemoRuntime({
    sessionStore,
    workspace,
    provider,
    model,
    apiKey,
    systemPrompt: deps.systemPrompt,
  });
  const renderer = createCliRenderer(stdout);

  let sessionId: string | undefined;
  const rl = deps.lines == null ? createInterface({ input: process.stdin, output: process.stdout, terminal: true }) : null;
  const lines: AsyncIterable<string> = (deps.lines ?? rl) as any;

  try {
    for await (const line of lines) {
      const trimmed = String(line ?? "").trim();
      if (!trimmed) continue;
      if (trimmed === "/exit" || trimmed === "/quit") break;

      if (trimmed === "/status") {
        if (!projectDir || !shadowForCommit || !baseSnapshot) {
          stderr.write("demo-node: /status requires --project\n");
          continue;
        }
        const cur = await snapshotWorkspace(shadowForCommit);
        const cs = computeChangeSet(baseSnapshot, cur);
        stdout.write(`status: +${cs.adds.length} ~${cs.modifies.length} -${cs.deletes.length}\n`);
        continue;
      }

      if (trimmed === "/commit") {
        if (!projectDir || !shadowForCommit || !baseSnapshot) {
          stderr.write("demo-node: /commit requires --project\n");
          continue;
        }
        const { changeSet } = await commitShadowToLocalDir({ realDir: projectDir, shadow: shadowForCommit, baseSnapshot });
        baseSnapshot = await snapshotWorkspace(shadowForCommit);
        stdout.write(`committed: +${changeSet.adds.length} ~${changeSet.modifies.length} -${changeSet.deletes.length}\n`);
        continue;
      }

      for await (const ev of runtime.runTurn({ sessionId, userText: trimmed })) {
        renderer.onEvent(ev);
        if (ev.type === "system.init") sessionId = (ev as any).sessionId;
      }
    }
  } finally {
    rl?.close();
  }

  return { exitCode: 0, sessionId };
}
