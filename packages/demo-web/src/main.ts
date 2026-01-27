import { JsonlSessionStore } from "@openagentic/sdk-core";
import type { Snapshot, WorkspaceEntry } from "@openagentic/workspace";
import {
  OpfsWorkspace,
  commitToDirectoryHandle,
  getOpfsRootDirectory,
  importFromDirectoryHandle,
  snapshotWorkspace,
} from "@openagentic/workspace";

import { createBrowserAgent } from "./agent.js";
import { reduceChatState } from "./state.js";

import "./styles.css";

class MemoryJsonlBackend {
  #files = new Map<string, string>();
  async mkdirp(_dir: string): Promise<void> {}
  async readText(path: string): Promise<string> {
    const v = this.#files.get(path);
    if (v == null) throw new Error("ENOENT");
    return v;
  }
  async writeText(path: string, text: string): Promise<void> {
    this.#files.set(path, text);
  }
  async appendText(path: string, text: string): Promise<void> {
    this.#files.set(path, (this.#files.get(path) ?? "") + text);
  }
}

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div class="oa">
      <header class="oaHeader">
        <div class="oaTitle">OpenAgentic Demo (Web)</div>
        <div class="oaSubtitle">Browser runtime + OPFS shadow workspace (use with local demo-proxy).</div>
      </header>

      <section class="oaControls">
        <label class="oaField">
          <div class="oaLabel">Proxy Base URL</div>
          <input id="proxyUrl" class="oaInput" value="http://localhost:8787/v1" />
        </label>
        <label class="oaField">
          <div class="oaLabel">Model</div>
          <input id="model" class="oaInput" value="gpt-4o-mini" />
        </label>
        <div class="oaButtons">
          <button id="chooseDir" class="oaBtn">Choose Directory</button>
          <button id="importDir" class="oaBtn">Import → OPFS</button>
          <button id="commitDir" class="oaBtn">Commit → Real</button>
        </div>
        <div id="status" class="oaStatus"></div>
      </section>

      <main class="oaMain">
        <div class="oaChat">
          <div id="transcript" class="oaTranscript"></div>
          <div class="oaComposer">
            <textarea id="prompt" class="oaPrompt" rows="3" placeholder="Type a message..."></textarea>
            <button id="send" class="oaBtn oaSend">Send</button>
          </div>
        </div>

        <aside class="oaSidebar">
          <div class="oaSidebarTitle">OPFS Workspace (root)</div>
          <div id="files" class="oaFiles"></div>
        </aside>
      </main>
    </div>
  `;

  const proxyUrlEl = document.querySelector<HTMLInputElement>("#proxyUrl")!;
  const modelEl = document.querySelector<HTMLInputElement>("#model")!;
  const statusEl = document.querySelector<HTMLDivElement>("#status")!;
  const transcriptEl = document.querySelector<HTMLDivElement>("#transcript")!;
  const filesEl = document.querySelector<HTMLDivElement>("#files")!;
  const promptEl = document.querySelector<HTMLTextAreaElement>("#prompt")!;
  const sendEl = document.querySelector<HTMLButtonElement>("#send")!;
  const chooseDirEl = document.querySelector<HTMLButtonElement>("#chooseDir")!;
  const importDirEl = document.querySelector<HTMLButtonElement>("#importDir")!;
  const commitDirEl = document.querySelector<HTMLButtonElement>("#commitDir")!;

  let state = { messages: [] as Array<{ role: "user" | "assistant"; text: string; streaming?: boolean }> };
  let sessionId: string | undefined;
  let realDirHandle: FileSystemDirectoryHandle | null = null;

  const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);

  const opfsRoot = await getOpfsRootDirectory();
  const demoDir = await (opfsRoot as any).getDirectoryHandle("openagentic-demo-web", { create: true });
  const workspace = new OpfsWorkspace(demoDir as any);
  let baseSnapshot: Snapshot = await snapshotWorkspace(workspace);

  function setStatus(text: string): void {
    statusEl.textContent = text;
  }

  function render(): void {
    transcriptEl.innerHTML = "";
    for (const m of state.messages) {
      const div = document.createElement("div");
      div.className = m.role === "user" ? "oaMsg oaUser" : "oaMsg oaAssistant";
      div.textContent = m.text;
      transcriptEl.appendChild(div);
    }
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  async function refreshFiles(): Promise<void> {
    const ents: WorkspaceEntry[] = await workspace.listDir("");
    filesEl.innerHTML = ents.length ? "" : `<div class="oaMuted">(empty)</div>`;
    for (const e of ents) {
      const row = document.createElement("div");
      row.className = "oaFileRow";
      row.textContent = `${e.type} ${e.name}`;
      filesEl.appendChild(row);
    }
  }

  async function runTurn(userText: string): Promise<void> {
    const agent = createBrowserAgent({
      sessionStore,
      workspace,
      model: modelEl.value.trim() || "gpt-4o-mini",
      providerBaseUrl: proxyUrlEl.value.trim() || "http://localhost:8787/v1",
    });

    for await (const ev of agent.runtime.runTurn({ sessionId, userText })) {
      if (ev.type === "system.init") sessionId = (ev as any).sessionId as string;
      if (ev.type === "assistant.delta") {
        state = reduceChatState(state as any, { type: "assistant_delta", delta: String((ev as any).textDelta ?? "") }) as any;
        render();
      } else if (ev.type === "assistant.message") {
        state = reduceChatState(state as any, { type: "assistant_final", text: String((ev as any).text ?? "") }) as any;
        render();
      }
    }

    await refreshFiles();
  }

  sendEl.addEventListener("click", async () => {
    const text = promptEl.value.trim();
    if (!text) return;
    promptEl.value = "";

    state = reduceChatState(state as any, { type: "user_message", text }) as any;
    render();

    try {
      setStatus("running...");
      await runTurn(text);
      setStatus(sessionId ? `session: ${sessionId}` : "ok");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  });

  chooseDirEl.addEventListener("click", async () => {
    const anyWin: any = window as any;
    if (typeof anyWin.showDirectoryPicker !== "function") {
      setStatus("File System Access API not available (showDirectoryPicker).");
      return;
    }
    realDirHandle = (await anyWin.showDirectoryPicker()) as FileSystemDirectoryHandle;
    setStatus("directory chosen");
  });

  importDirEl.addEventListener("click", async () => {
    if (!realDirHandle) {
      setStatus("choose a directory first");
      return;
    }
    setStatus("importing...");
    await importFromDirectoryHandle(realDirHandle as any, workspace, {
      filter: (path, kind) => {
        if (path.startsWith(".openagentic/")) return false;
        if (kind === "dir" && path === ".openagentic") return false;
        return true;
      },
    });
    baseSnapshot = await snapshotWorkspace(workspace);
    await refreshFiles();
    setStatus("imported to OPFS");
  });

  commitDirEl.addEventListener("click", async () => {
    if (!realDirHandle) {
      setStatus("choose a directory first");
      return;
    }
    setStatus("computing changes...");
    const { changeSet } = await commitToDirectoryHandle(realDirHandle as any, workspace, baseSnapshot, {
      approve: async (cs) => {
        const msg = `Commit changes?\\n\\n+${cs.adds.length} ~${cs.modifies.length} -${cs.deletes.length}`;
        return window.confirm(msg);
      },
    });
    baseSnapshot = await snapshotWorkspace(workspace);
    await refreshFiles();
    setStatus(`committed: +${changeSet.adds.length} ~${changeSet.modifies.length} -${changeSet.deletes.length}`);
  });

  await refreshFiles();
  render();
  setStatus("ready");
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  const statusEl = document.querySelector<HTMLDivElement>("#status");
  if (statusEl) statusEl.textContent = msg;
  console.error(e);
});
