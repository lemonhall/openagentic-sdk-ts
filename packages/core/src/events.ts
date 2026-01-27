export type EventBase = {
  type: string;
  ts?: number;
  seq?: number;
};

export type SystemInitEvent = EventBase & {
  type: "system.init";
  sessionId: string;
  sdkVersion?: string;
  cwd?: string;
  optionsSummary?: Record<string, unknown>;
};

export type UserMessageEvent = EventBase & {
  type: "user.message";
  text: string;
};

export type AssistantMessageEvent = EventBase & {
  type: "assistant.message";
  text: string;
};

export type AssistantDeltaEvent = EventBase & {
  type: "assistant.delta";
  textDelta: string;
};

export type ToolUseEvent = EventBase & {
  type: "tool.use";
  toolUseId: string;
  name: string;
  input?: Record<string, unknown>;
};

export type ToolResultEvent = EventBase & {
  type: "tool.result";
  toolUseId: string;
  output: unknown;
  isError?: boolean;
  errorType?: string;
  errorMessage?: string;
};

export type ResultEvent = EventBase & {
  type: "result";
  finalText: string;
  stopReason?: string;
  usage?: Record<string, unknown>;
};

export type Event =
  | SystemInitEvent
  | UserMessageEvent
  | AssistantMessageEvent
  | AssistantDeltaEvent
  | ToolUseEvent
  | ToolResultEvent
  | ResultEvent
  // forward-compatible catch-all
  | EventBase;

