import type { ChangeItem, ChangeKind } from "./changeset-model.js";

export function formatChangeSetSummary(counts: { add: number; modify: number; delete: number }): string {
  return `+${counts.add} ~${counts.modify} -${counts.delete}`;
}

export function renderChangeSetSummary(counts: { add: number; modify: number; delete: number }): HTMLElement {
  const el = document.createElement("div");
  el.className = "oaChangesSummary";
  el.textContent = formatChangeSetSummary(counts);
  return el;
}

export function renderChangeList(options: {
  items: ChangeItem[];
  selectedPath?: string | null;
  onSelect: (path: string) => void;
}): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "oaChangesList";

  for (const it of options.items) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "oaChangesRow";
    if (it.path === options.selectedPath) row.classList.add("isSelected");
    row.dataset.path = it.path;

    const kind = document.createElement("span");
    kind.className = `oaChangesKind oaChangesKind--${it.kind}`;
    kind.textContent = kindLabel(it.kind);

    const name = document.createElement("span");
    name.className = "oaChangesPath";
    name.textContent = it.path;

    row.append(kind, name);
    row.addEventListener("click", () => options.onSelect(it.path));
    wrap.appendChild(row);
  }

  return wrap;
}

function kindLabel(kind: ChangeKind): string {
  if (kind === "add") return "A";
  if (kind === "modify") return "M";
  return "D";
}
