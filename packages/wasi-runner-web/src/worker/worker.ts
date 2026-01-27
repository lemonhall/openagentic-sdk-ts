import { InProcessWasiRunner } from "../in-process.js";
import type { WorkerExecRequest, WorkerExecResponse } from "./protocol.js";

const runner = new InProcessWasiRunner();

const scope: any = globalThis as any;

scope.onmessage = async (ev: MessageEvent<WorkerExecRequest>) => {
  const msg = ev.data as WorkerExecRequest;
  if (!msg || msg.type !== "exec") return;

  let out: WorkerExecResponse;
  try {
    const result = await runner.execModule(msg.input);
    out = { type: "result", id: msg.id, ok: true, result };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    out = { type: "result", id: msg.id, ok: false, errorName: err.name, errorMessage: err.message };
  }

  scope.postMessage(out);
};

