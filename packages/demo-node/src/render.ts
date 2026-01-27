import type { Event } from "@openagentic/sdk-core";

export type CliRenderer = {
  onEvent: (e: Event) => void;
};

export function createCliRenderer(io: { write: (s: string) => void }): CliRenderer {
  let inAssistant = false;
  let endedWithNewline = true;

  function write(s: string): void {
    io.write(s);
    endedWithNewline = s.endsWith("\n");
  }

  return {
    onEvent(e: Event) {
      if (e.type === "assistant.delta") {
        if (!inAssistant) {
          write("assistant> ");
          inAssistant = true;
        }
        write(String((e as any).textDelta ?? ""));
        return;
      }

      if (e.type === "assistant.message") {
        // If streaming already printed the content, just end the line.
        if (inAssistant) {
          if (!endedWithNewline) write("\n");
        } else {
          write(`assistant> ${(e as any).text ?? ""}\n`);
        }
        inAssistant = false;
        endedWithNewline = true;
        return;
      }

      if (e.type === "tool.use") {
        write(`tool.use ${String((e as any).name ?? "")}\n`);
        return;
      }

      if (e.type === "tool.result") {
        const ok = (e as any).isError ? "ERR" : "OK";
        write(`tool.result ${ok}\n`);
        return;
      }

      if (e.type === "result") {
        if (inAssistant && !endedWithNewline) write("\n");
        inAssistant = false;
        endedWithNewline = true;
        return;
      }
    },
  };
}
