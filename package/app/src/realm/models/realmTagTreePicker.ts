import type { TagTreeNode } from "@rezics/contract";

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

type MaybeDescribedNode = TagTreeNode & {
  description?: string;
  labelDescription?: string;
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function realmTagTreeNodeLabel(
  node: TagTreeNode,
  language: string,
): string {
  const translations = node.labelTranslations?.translations;
  const fallbackLanguage = node.labelTranslations?.fallbackLanguage;
  return (
    text(translations?.[language]) ??
    (fallbackLanguage ? text(translations?.[fallbackLanguage]) : undefined) ??
    text(node.label) ??
    (node.tagId ? node.tagId.slice(0, 8) : undefined) ??
    "Untitled"
  );
}

function nodeDescription(node: TagTreeNode): string | undefined {
  const described = node as MaybeDescribedNode;
  return text(described.description) ?? text(described.labelDescription);
}

export function buildRealmTagTreePickerRows(
  nodes: TagTreeNode[] | undefined,
  language: string,
): RealmTagTreePickerRow[] {
  const visit = (
    items: TagTreeNode[],
    path: string[],
    keyPath: string[],
  ): RealmTagTreePickerRow[] =>
    items.map((node, index) => {
      const label = realmTagTreeNodeLabel(node, language);
      const nextPath = [...path, label];
      const nodeKey = node.tagId ?? node.label ?? "node";
      const id = [...keyPath, `${index}:${nodeKey}`].join("/");
      const children = visit(node.children ?? [], nextPath, [
        ...keyPath,
        `${index}:${nodeKey}`,
      ]);
      return {
        id,
        tagId: node.tagId,
        label,
        description: nodeDescription(node),
        path: nextPath,
        pathLabel: path.join(" / "),
        children,
        selectable: Boolean(node.tagId),
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
