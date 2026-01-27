export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
};

export type ChatState = {
  messages: ChatMessage[];
};

export type ChatAction =
  | { type: "assistant_delta"; delta: string }
  | { type: "assistant_final"; text: string }
  | { type: "user_message"; text: string };

export function reduceChatState(state: ChatState, action: ChatAction): ChatState {
  if (action.type === "user_message") {
    return { ...state, messages: [...state.messages, { role: "user", text: action.text }] };
  }

  if (action.type === "assistant_delta") {
    const last = state.messages.at(-1);
    if (last && last.role === "assistant" && last.streaming) {
      const nextLast: ChatMessage = { ...last, text: last.text + action.delta, streaming: true };
      return { ...state, messages: [...state.messages.slice(0, -1), nextLast] };
    }
    return { ...state, messages: [...state.messages, { role: "assistant", text: action.delta, streaming: true }] };
  }

  if (action.type === "assistant_final") {
    const last = state.messages.at(-1);
    if (last && last.role === "assistant") {
      const nextLast: ChatMessage = { ...last, text: action.text, streaming: false };
      return { ...state, messages: [...state.messages.slice(0, -1), nextLast] };
    }
    return { ...state, messages: [...state.messages, { role: "assistant", text: action.text, streaming: false }] };
  }

  return state;
}
