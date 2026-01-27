import { InProcessWasiRunner } from "../in-process.js";
import type { WorkerExecRequest, WorkerExecResponse } from "./protocol.js";
import { openOpfsWorkspace, WorkspaceMountedWasiRunner } from "./opfs-sync-fs.js";

const snapshotRunner = new InProcessWasiRunner();
const mountedRunners = new Map<string, Promise<WorkspaceMountedWasiRunner>>();

const scope: any = globalThis as any;

scope.onmessage = async (ev: MessageEvent<WorkerExecRequest>) => {
  const msg = ev.data as WorkerExecRequest;
  if (!msg || msg.type !== "exec") return;

  let out: WorkerExecResponse;
  try {
    const preopen = typeof msg.input.preopenDir === "string" ? msg.input.preopenDir.trim() : "";
    const result =
      preopen.length > 0
        ? await (async () => {
            let p = mountedRunners.get(preopen);
            if (!p) {
              p = (async () => {
                const ws = await openOpfsWorkspace(preopen);
                return new WorkspaceMountedWasiRunner({ workspace: ws });
              })();
              mountedRunners.set(preopen, p);
            }
            const runner = await p;
            return runner.execModule({ ...msg.input, fs: undefined });
          })()
        : await snapshotRunner.execModule(msg.input);
    out = { type: "result", id: msg.id, ok: true, result };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    out = { type: "result", id: msg.id, ok: false, errorName: err.name, errorMessage: err.message };
  }

  scope.postMessage(out);
};
