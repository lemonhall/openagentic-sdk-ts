import type { Snapshot, WorkspaceEntry } from "@openagentic/workspace";
import {
  OpfsWorkspace,
  commitToDirectoryHandle,
  computeChangeSet,
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
import { decodeTextPreview } from "./changeset-preview.js";
import { summarizeChangeSet } from "./changeset-model.js";
import { formatChangeSetSummary, renderChangeList } from "./changeset-ui.js";
import { createDemoSessionStore } from "./session-store.js";

import "./styles.css";

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

      <div id="changesModal" class="oaModal oaHidden" aria-hidden="true">
        <div class="oaModalBackdrop"></div>
        <div class="oaModalPanel" role="dialog" aria-modal="true" aria-label="Review changes">
          <div class="oaModalHeader">
            <div class="oaModalTitle">Review Changes</div>
            <div id="changesSummary" class="oaChangesSummary"></div>
          </div>
          <div class="oaModalBody">
            <div class="oaChangesCols">
              <div>
                <div class="oaSectionTitle">Files</div>
                <div id="changesList" class="oaChangesList"></div>
              </div>
              <div>
                <div class="oaSectionTitle">Preview</div>
                <div id="changesPreview" class="oaChangesPreview">(select a file)</div>
              </div>
            </div>
          </div>
          <div class="oaModalFooter">
            <button id="changesCancel" class="oaBtn">Cancel</button>
            <button id="changesApply" class="oaBtn oaBtnPrimary">Apply Commit</button>
          </div>
        </div>
      </div>
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
  const resetOpfsEl = document.querySelector<HTMLButtonElement>("#resetOpfs")!;
  const changesModalEl = document.querySelector<HTMLDivElement>("#changesModal")!;
  const changesSummaryEl = document.querySelector<HTMLDivElement>("#changesSummary")!;
  const changesListEl = document.querySelector<HTMLDivElement>("#changesList")!;
  const changesPreviewEl = document.querySelector<HTMLDivElement>("#changesPreview")!;
  const changesCancelEl = document.querySelector<HTMLButtonElement>("#changesCancel")!;
  const changesApplyEl = document.querySelector<HTMLButtonElement>("#changesApply")!;

  let state = { messages: [] as Array<{ role: "user" | "assistant"; text: string; streaming?: boolean }> };
  let realDirHandle: FileSystemDirectoryHandle | null = null;

  const sessionStore = createDemoSessionStore();

  const OPFS_DIR = "openagentic-demo-web";

  let workspace: OpfsWorkspace | null = null;
  let baseSnapshot: Snapshot | null = null;
  let workspaceInit: Promise<void> | null = null;
  let opfsDemoDir: any | null = null;
  let pendingChangeSet: ReturnType<typeof computeChangeSet> | null = null;
  let pendingChangeSummary: ReturnType<typeof summarizeChangeSet> | null = null;
  let selectedChangePath: string | null = null;
  let previewToken = 0;
  let runtimeCache: { key: string; runtime: any; refreshFiles: () => Promise<void> } | null = null;

  function runtimeKey(): string {
    return JSON.stringify({
      model: modelEl.value.trim() || "gpt-5.2",
      providerBaseUrl: proxyUrlEl.value.trim() || "http://localhost:8787/v1",
      opfsDir: OPFS_DIR,
    });
  }

  function invalidateRuntime(): void {
    runtimeCache = null;
  }

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
        opfsDemoDir = await (opfsRoot as any).getDirectoryHandle(OPFS_DIR, { create: true });
        workspace = new OpfsWorkspace(opfsDemoDir as any);
        // Important: OPFS persists across reloads; avoid full snapshot/hashing on startup.
        baseSnapshot = null;
      })();
    }
    await workspaceInit;
  }

  function openModal(): void {
    changesModalEl.classList.remove("oaHidden");
    changesModalEl.setAttribute("aria-hidden", "false");
  }

  function closeModal(): void {
    changesModalEl.classList.add("oaHidden");
    changesModalEl.setAttribute("aria-hidden", "true");
    pendingChangeSet = null;
    pendingChangeSummary = null;
    selectedChangePath = null;
    changesSummaryEl.textContent = "";
    changesListEl.innerHTML = "";
    changesPreviewEl.textContent = "(select a file)";
  }

  async function readRealFile(path: string): Promise<Uint8Array> {
    if (!realDirHandle) throw new Error("No real directory selected");
    const parts = path.split("/").filter(Boolean);
    let dir: any = realDirHandle as any;
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
    const fileHandle = await dir.getFileHandle(parts.at(-1));
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  }

  async function renderPreview(path: string): Promise<void> {
    const my = ++previewToken;
    if (!pendingChangeSet || !workspace) return;
    changesPreviewEl.textContent = "loading...";

    const cs = pendingChangeSet;
    const kind =
      cs.adds.some((c: any) => c.path === path) ? "add" : cs.deletes.some((c: any) => c.path === path) ? "delete" : "modify";

    let before: string | null = null;
    let after: string | null = null;

    if (kind !== "add") {
      try {
        const bytes = await readRealFile(path);
        const p = decodeTextPreview(bytes);
        before = p ? p.text + (p.truncated ? "\n…(truncated)" : "") : "(binary)";
      } catch {
        before = "(unavailable)";
      }
    }

    if (kind !== "delete") {
      try {
        const bytes = await workspace.readFile(path);
        const p = decodeTextPreview(bytes);
        after = p ? p.text + (p.truncated ? "\n…(truncated)" : "") : "(binary)";
      } catch {
        after = "(unavailable)";
      }
    }

    if (my !== previewToken) return;

    const wrap = document.createElement("div");
    wrap.className = "oaPreviewWrap";

    const title = document.createElement("div");
    title.className = "oaPreviewTitle";
    title.textContent = `${kind.toUpperCase()} ${path}`;
    wrap.appendChild(title);

    if (before != null) {
      const h = document.createElement("div");
      h.className = "oaPreviewLabel";
      h.textContent = "before";
      const pre = document.createElement("pre");
      pre.className = "oaPreviewPre";
      pre.textContent = before;
      wrap.append(h, pre);
    }

    if (after != null) {
      const h = document.createElement("div");
      h.className = "oaPreviewLabel";
      h.textContent = "after";
      const pre = document.createElement("pre");
      pre.className = "oaPreviewPre";
      pre.textContent = after;
      wrap.append(h, pre);
    }

    changesPreviewEl.innerHTML = "";
    changesPreviewEl.appendChild(wrap);
  }

  function renderChangesList(): void {
    if (!pendingChangeSummary) return;
    changesListEl.innerHTML = "";
    changesListEl.appendChild(
      renderChangeList({
        items: pendingChangeSummary.items,
        selectedPath: selectedChangePath,
        onSelect: async (p) => {
          selectedChangePath = p;
          renderChangesList();
          await renderPreview(p);
        },
      }),
    );
  }

  async function reviewPendingChanges(): Promise<void> {
    await ensureWorkspace();
    if (!workspace || !baseSnapshot) throw new Error("OPFS workspace is not initialized (import first)");

    const cur = await snapshotWorkspace(workspace);
    const changeSet = computeChangeSet(baseSnapshot, cur);
    const summary = summarizeChangeSet(changeSet);
    pendingChangeSet = changeSet;
    pendingChangeSummary = summary;

    changesSummaryEl.textContent = formatChangeSetSummary(summary.counts);

    if (!summary.items.length) {
      selectedChangePath = null;
      pendingChangeSummary = summary;
      changesListEl.innerHTML = `<div class="oaMuted">(no changes)</div>`;
      changesPreviewEl.textContent = "(no changes)";
      openModal();
      return;
    }

    if (!selectedChangePath || !summary.items.some((i) => i.path === selectedChangePath)) {
      selectedChangePath = summary.items[0]!.path;
    }
    renderChangesList();

    openModal();
    if (selectedChangePath) await renderPreview(selectedChangePath);
  }

  changesCancelEl.addEventListener("click", () => closeModal());
  changesModalEl.addEventListener("click", (e) => {
    if ((e.target as HTMLElement)?.classList?.contains("oaModalBackdrop")) closeModal();
  });

  changesApplyEl.addEventListener("click", async () => {
    try {
      if (!realDirHandle) {
        setStatus("choose a directory first");
        return;
      }
      await ensureWorkspace();
      if (!workspace || !baseSnapshot) throw new Error("OPFS workspace is not initialized (import first)");
      setStatus("committing...");
      await commitToDirectoryHandle(realDirHandle as any, workspace, baseSnapshot);
      baseSnapshot = await snapshotWorkspace(workspace);
      await refreshFiles();
      closeModal();
      setStatus("committed");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  });

  const controller = createController({
    ensureRuntime: async () => {
      await ensureWorkspace();
      if (!workspace) throw new Error("OPFS workspace init failed");
      const key = runtimeKey();
      if (runtimeCache?.key === key) return { runtime: runtimeCache.runtime, refreshFiles: runtimeCache.refreshFiles };

      const agent = await createBrowserAgent({
        sessionStore,
        workspace,
        model: modelEl.value.trim() || "gpt-5.2",
        providerBaseUrl: proxyUrlEl.value.trim() || "http://localhost:8787/v1",
      });
      runtimeCache = { key, runtime: agent.runtime, refreshFiles };
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
      invalidateRuntime();
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
      await reviewPendingChanges();
      setStatus("review changes, then apply commit");
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
      invalidateRuntime();
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
