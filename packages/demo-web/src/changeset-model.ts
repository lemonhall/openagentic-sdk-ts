import type { ChangeSet } from "@openagentic/workspace";

export type ChangeKind = "add" | "modify" | "delete";

export type ChangeItem = { kind: ChangeKind; path: string };

export function summarizeChangeSet(changeSet: ChangeSet): {
  counts: { add: number; modify: number; delete: number };
  items: ChangeItem[];
} {
  const items: ChangeItem[] = [];
  for (const c of changeSet.deletes ?? []) items.push({ kind: "delete", path: c.path });
  for (const c of changeSet.modifies ?? []) items.push({ kind: "modify", path: c.path });
  for (const c of changeSet.adds ?? []) items.push({ kind: "add", path: c.path });
  items.sort((a, b) => a.path.localeCompare(b.path));
  return {
    counts: {
      add: changeSet.adds?.length ?? 0,
      modify: changeSet.modifies?.length ?? 0,
      delete: changeSet.deletes?.length ?? 0,
    },
    items,
  };
}

