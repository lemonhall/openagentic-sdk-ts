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
import { createController } from "./controller.js";
import { clearDirectoryHandle } from "./fs-utils.js";
import { shouldSubmitOnKeydown } from "./composer.js";
import { reduceChatState } from "./state.js";
import { iconKindForEntry, iconSvgForKind } from "./file-icons.js";

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
          <input id="model" class="oaInput" value="gpt-5.2" />
        </label>
        <label class="oaToggle">
          <input id="wasiBash" type="checkbox" checked />
          <span>WASI Bash</span>
        </label>
        <div class="oaButtons">
          <button id="chooseDir" class="oaBtn">Choose Directory</button>
          <button id="importDir" class="oaBtn">Import → OPFS</button>
          <button id="commitDir" class="oaBtn">Commit → Real</button>
          <button id="resetOpfs" class="oaBtn">Reset OPFS</button>
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
  const wasiBashEl = document.querySelector<HTMLInputElement>("#wasiBash")!;
  const statusEl = document.querySelector<HTMLDivElement>("#status")!;
  const transcriptEl = document.querySelector<HTMLDivElement>("#transcript")!;
  const filesEl = document.querySelector<HTMLDivElement>("#files")!;
  const promptEl = document.querySelector<HTMLTextAreaElement>("#prompt")!;
  const sendEl = document.querySelector<HTMLButtonElement>("#send")!;
  const chooseDirEl = document.querySelector<HTMLButtonElement>("#chooseDir")!;
  const importDirEl = document.querySelector<HTMLButtonElement>("#importDir")!;
  const commitDirEl = document.querySelector<HTMLButtonElement>("#commitDir")!;
  const resetOpfsEl = document.querySelector<HTMLButtonElement>("#resetOpfs")!;

  let state = { messages: [] as Array<{ role: "user" | "assistant"; text: string; streaming?: boolean }> };
  let realDirHandle: FileSystemDirectoryHandle | null = null;

  const sessionStore = new JsonlSessionStore(new MemoryJsonlBackend() as any);

  let workspace: OpfsWorkspace | null = null;
  let baseSnapshot: Snapshot | null = null;
  let workspaceInit: Promise<void> | null = null;
  let opfsDemoDir: any | null = null;

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
    await ensureWorkspace();
    if (!workspace) return;
    const ents: WorkspaceEntry[] = await workspace.listDir("");
    filesEl.innerHTML = ents.length ? "" : `<div class="oaMuted">(empty)</div>`;
    for (const e of ents) {
      const row = document.createElement("div");
      row.className = "oaFileRow";
      row.title = e.name;
      const kind = iconKindForEntry(e);

      const icon = document.createElement("span");
      icon.className = `oaFileIcon oaIcon--${kind}`;
      icon.innerHTML = iconSvgForKind(kind);

      const label = document.createElement("span");
      label.className = "oaFileName";
      label.textContent = e.name;

      row.append(icon, label);
      filesEl.appendChild(row);
    }
  }

  async function ensureWorkspace(): Promise<void> {
    if (workspace) return;
    if (!workspaceInit) {
      workspaceInit = (async () => {
        const opfsRoot = await getOpfsRootDirectory();
        opfsDemoDir = await (opfsRoot as any).getDirectoryHandle("openagentic-demo-web", { create: true });
        workspace = new OpfsWorkspace(opfsDemoDir as any);
        // Important: OPFS persists across reloads; avoid full snapshot/hashing on startup.
        baseSnapshot = null;
      })();
    }
    await workspaceInit;
  }

  const controller = createController({
    ensureRuntime: async () => {
      await ensureWorkspace();
      if (!workspace) throw new Error("OPFS workspace init failed");
      const agent = await createBrowserAgent({
        sessionStore,
        workspace,
        model: modelEl.value.trim() || "gpt-5.2",
        providerBaseUrl: proxyUrlEl.value.trim() || "http://localhost:8787/v1",
        enableWasiBash: wasiBashEl.checked,
      });
      return { runtime: agent.runtime, refreshFiles };
    },
    onUserMessage: (t) => {
      state = reduceChatState(state as any, { type: "user_message", text: t }) as any;
      render();
    },
    onAssistantDelta: (delta) => {
      state = reduceChatState(state as any, { type: "assistant_delta", delta }) as any;
      render();
    },
    onAssistantFinal: (text) => {
      state = reduceChatState(state as any, { type: "assistant_final", text }) as any;
      render();
    },
    setStatus: (t) => setStatus(t),
  });

  async function sendCurrentPrompt(): Promise<void> {
    const text = promptEl.value;
    promptEl.value = "";
    await controller.send(text);
  }

  sendEl.addEventListener("click", async () => {
    await sendCurrentPrompt();
  });

  promptEl.addEventListener("keydown", async (e) => {
    const ev = e as KeyboardEvent;
    if (!shouldSubmitOnKeydown(ev)) return;
    ev.preventDefault();
    await sendCurrentPrompt();
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
    try {
      if (!realDirHandle) {
        setStatus("choose a directory first");
        return;
      }
      setStatus("importing (clearing OPFS)...");
      await ensureWorkspace();
      if (!workspace || !opfsDemoDir) throw new Error("OPFS workspace init failed");

      // Treat import as resetting the shadow workspace to match the selected directory.
      await clearDirectoryHandle(opfsDemoDir as any);

      setStatus("importing...");
      await importFromDirectoryHandle(realDirHandle as any, workspace, {
        filter: (path, kind) => {
          if (path.startsWith(".openagentic/")) return false;
          if (kind === "dir" && path === ".openagentic") return false;
          return true;
        },
      });
      setStatus("snapshotting...");
      baseSnapshot = await snapshotWorkspace(workspace);
      await refreshFiles();
      setStatus("imported to OPFS");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  });

  commitDirEl.addEventListener("click", async () => {
    try {
      if (!realDirHandle) {
        setStatus("choose a directory first");
        return;
      }
      setStatus("computing changes...");
      await ensureWorkspace();
      if (!workspace || !baseSnapshot) throw new Error("OPFS workspace is not initialized (import first)");
      const { changeSet } = await commitToDirectoryHandle(realDirHandle as any, workspace, baseSnapshot, {
        approve: async (cs) => {
          const msg = `Commit changes?\\n\\n+${cs.adds.length} ~${cs.modifies.length} -${cs.deletes.length}`;
          return window.confirm(msg);
        },
      });
      baseSnapshot = await snapshotWorkspace(workspace);
      await refreshFiles();
      setStatus(`committed: +${changeSet.adds.length} ~${changeSet.modifies.length} -${changeSet.deletes.length}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  });

  resetOpfsEl.addEventListener("click", async () => {
    try {
      setStatus("clearing OPFS...");
      await ensureWorkspace();
      if (!opfsDemoDir || !workspace) throw new Error("OPFS workspace init failed");
      await clearDirectoryHandle(opfsDemoDir as any);
      baseSnapshot = null;
      await refreshFiles();
      setStatus("OPFS cleared");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  });

  render();
  setStatus("ready (click Send to initialize OPFS)");

  // Best-effort warmup so failures show up in status, but never block UI wiring.
  ensureWorkspace()
    .then(refreshFiles)
    .then(() => setStatus("ready"))
    .catch((e) => setStatus(e instanceof Error ? e.message : String(e)));
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  const statusEl = document.querySelector<HTMLDivElement>("#status");
  if (statusEl) statusEl.textContent = msg;
  console.error(e);
});
