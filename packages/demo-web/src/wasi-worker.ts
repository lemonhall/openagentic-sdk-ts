import { InProcessWasiRunner } from "@openagentic/wasi-runner-web";
import type { WasiExecInput } from "@openagentic/wasi-runner";

const runner = new InProcessWasiRunner();

const scope: any = globalThis as any;

scope.onmessage = async (ev: MessageEvent<{ type: "exec"; id: string; input: WasiExecInput }>) => {
  const msg = ev.data;
  if (!msg || msg.type !== "exec") return;

  try {
    const result = await runner.execModule(msg.input);
    scope.postMessage({ type: "result", id: msg.id, ok: true, result });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    scope.postMessage({ type: "result", id: msg.id, ok: false, errorName: err.name, errorMessage: err.message });
  }
};

