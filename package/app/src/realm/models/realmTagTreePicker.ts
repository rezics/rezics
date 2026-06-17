import type { RealmTagTreeNode } from "@rezics/contract";
import {
  realmTagTreeNodeDisplayLabel,
  type RealmTagTreeDisplayNames,
} from "./realmTagTreeHydration";

export type RealmTagTreePickerRow = {
  id: string;
  tagId?: string;
  label: string;
  description?: string;
  path: string[];
  pathLabel: string;
  children: RealmTagTreePickerRow[];
  selectable: boolean;
};

export type RealmTagTreeSearchMatch = RealmTagTreePickerRow & {
  matchText: string;
};

export function buildRealmTagTreePickerRows(
  nodes: RealmTagTreeNode[] | undefined,
  displayNames?: RealmTagTreeDisplayNames,
): RealmTagTreePickerRow[] {
  const visit = (
    items: RealmTagTreeNode[],
    path: string[],
    keyPath: string[],
  ): RealmTagTreePickerRow[] =>
    items.map((node, index) => {
      const label = realmTagTreeNodeDisplayLabel(node, displayNames);
      const nextPath = [...path, label];
      const nodeKey = node.kind === "tag" ? node.tagUnitId : node.labelUnitId;
      const id = [...keyPath, `${index}:${nodeKey}`].join("/");
      const children = visit(node.children ?? [], nextPath, [
        ...keyPath,
        `${index}:${nodeKey}`,
      ]);
      return {
        id,
        tagId: node.kind === "tag" ? node.tagUnitId : undefined,
        label,
        path: nextPath,
        pathLabel: path.join(" / "),
        children,
        selectable: node.kind === "tag",
      };
    });

  return visit(nodes ?? [], [], []);
}

export function flattenRealmTagTreePickerRows(
  rows: RealmTagTreePickerRow[],
): RealmTagTreePickerRow[] {
  const flattened: RealmTagTreePickerRow[] = [];
  const visit = (items: RealmTagTreePickerRow[]) => {
    for (const item of items) {
      flattened.push(item);
      visit(item.children);
    }
  };
  visit(rows);
  return flattened;
}

export function searchRealmTagTreePickerRows(
  rows: RealmTagTreePickerRow[],
  query: string,
): RealmTagTreeSearchMatch[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return flattenRealmTagTreePickerRows(rows)
    .filter((row) => {
      const haystack = [
        row.label,
        row.description,
        row.path.join(" "),
        row.tagId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(normalized);
    })
    .map((row) => ({
      ...row,
      matchText: row.path.join(" / "),
    }));
}

export function selectedRealmTagLabels(
  rows: RealmTagTreePickerRow[],
  selectedTagIds: string[],
  fallbackLabel: (tagId: string) => string,
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const row of flattenRealmTagTreePickerRows(rows)) {
    if (row.tagId) labels.set(row.tagId, row.label);
  }
  for (const tagId of selectedTagIds) {
    if (!labels.has(tagId)) labels.set(tagId, fallbackLabel(tagId));
  }
  return labels;
}
