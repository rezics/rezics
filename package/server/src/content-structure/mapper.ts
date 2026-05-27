import type { ContentStructureItem } from "@rezics/contract";
import type { ContentStructureNodeRow } from "./types";

export function buildContentStructureTree(
  rows: readonly ContentStructureNodeRow[],
): ContentStructureItem[] {
  if (rows.length === 0) return [];

  const childrenByParent = new Map<string | null, ContentStructureNodeRow[]>();
  for (const row of rows) {
    const bucket = childrenByParent.get(row.parentId);
    if (bucket) {
      bucket.push(row);
    } else {
      childrenByParent.set(row.parentId, [row]);
    }
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) =>
      a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0,
    );
  }

  function rowToNode(row: ContentStructureNodeRow): ContentStructureItem {
    const item: ContentStructureItem = {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    };
    if (row.contentUnitId) {
      item.contentUnitId = row.contentUnitId;
    }
    if (row.noContent) item.noContent = row.noContent;
    if (row.rating) item.rating = row.rating;
    const children = childrenByParent.get(row.id);
    if (children && children.length > 0) {
      item.children = children.map(rowToNode);
    }
    return item;
  }

  return (childrenByParent.get(null) ?? []).map(rowToNode);
}

export function resolveContentStructurePath(
  rows: readonly ContentStructureNodeRow[],
  path: readonly number[],
): ContentStructureNodeRow | null {
  validateContentStructurePath([...path]);
  if (path.length === 0) return null;

  const childrenByParent = new Map<string | null, ContentStructureNodeRow[]>();
  for (const row of rows) {
    const bucket = childrenByParent.get(row.parentId);
    if (bucket) {
      bucket.push(row);
    } else {
      childrenByParent.set(row.parentId, [row]);
    }
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) =>
      a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0,
    );
  }

  let parentId: string | null = null;
  let current: ContentStructureNodeRow | undefined;
  for (const segment of path) {
    const siblings: ContentStructureNodeRow[] =
      childrenByParent.get(parentId) ?? [];
    current = siblings[segment];
    if (!current) return null;
    parentId = current.id;
  }
  return current ?? null;
}

export function validateContentStructurePath(path: number[]): number[] {
  for (const segment of path) {
    if (!Number.isInteger(segment) || segment < 0) {
      throw new Error(
        "ContentStructure path segments must be non-negative integers",
      );
    }
  }
  return path;
}
