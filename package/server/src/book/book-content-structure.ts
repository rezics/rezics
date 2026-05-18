import type { ChapterTreeItem, ContentRating } from "@rezics/contract";

export class BookContentStructurePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookContentStructurePathError";
  }
}

export function parseBookContentStructurePath(
  path: string | number[],
): number[] {
  if (Array.isArray(path)) return validateBookContentStructurePath(path);
  if (path.trim() === "") return [];
  return validateBookContentStructurePath(
    path.split(".").map((part) => {
      const index = Number(part);
      if (!Number.isInteger(index)) {
        throw new BookContentStructurePathError(
          `Invalid BookContentStructure path segment: ${part}`,
        );
      }
      return index;
    }),
  );
}

export function validateBookContentStructurePath(path: number[]): number[] {
  for (const segment of path) {
    if (!Number.isInteger(segment) || segment < 0) {
      throw new BookContentStructurePathError(
        `BookContentStructure path segments must be non-negative integers`,
      );
    }
  }
  return path;
}

/**
 * A minimal shape capturing the BookContentStructureNode row fields we read
 * to assemble the wire tree. Defined structurally so tests can supply plain
 * objects without pulling in Prisma's generated types.
 */
export interface BookContentStructureNodeRow {
  id: string;
  bookUnitId: string;
  parentId: string | null;
  sortKey: string;
  chapterUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Assemble a flat list of node rows into the nested `ChapterTreeItem[]` wire
 * shape. Children at each level are ordered lexicographically by `sortKey`.
 * Runs in O(n) with one pass to bucket by `parentId` and one DFS from roots.
 *
 * `id` and `updatedAt` are populated on every returned node. `rating` is
 * omitted when the row's column is NULL.
 */
export function buildTree(
  rows: readonly BookContentStructureNodeRow[],
): ChapterTreeItem[] {
  if (rows.length === 0) return [];

  const childrenByParent = new Map<
    string | null,
    BookContentStructureNodeRow[]
  >();
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

  function rowToNode(row: BookContentStructureNodeRow): ChapterTreeItem {
    const item: ChapterTreeItem = {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    };
    if (row.chapterUnitId) item.chapterUnitId = row.chapterUnitId;
    if (row.noContent) item.noContent = row.noContent;
    if (row.rating) item.rating = row.rating;
    const children = childrenByParent.get(row.id);
    if (children && children.length > 0) {
      item.children = children.map(rowToNode);
    }
    return item;
  }

  const roots = childrenByParent.get(null) ?? [];
  return roots.map(rowToNode);
}

/**
 * Resolve a `BookContentStructurePath` against a flat list of node rows.
 * Returns the target row, or `null` if any segment fails to resolve.
 *
 * Stale-path semantics: a path with an out-of-range segment returns `null`
 * rather than throwing — callers (materialization) translate this into a
 * conflict response.
 */
export function resolvePath(
  rows: readonly BookContentStructureNodeRow[],
  path: readonly number[],
): BookContentStructureNodeRow | null {
  validateBookContentStructurePath([...path]);
  if (path.length === 0) return null;

  const childrenByParent = new Map<
    string | null,
    BookContentStructureNodeRow[]
  >();
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
  let current: BookContentStructureNodeRow | undefined;
  for (const segment of path) {
    const siblings: BookContentStructureNodeRow[] =
      childrenByParent.get(parentId) ?? [];
    current = siblings[segment];
    if (!current) return null;
    parentId = current.id;
  }
  return current ?? null;
}

/**
 * Convenience wrapper returning the resolved node id (or null if the path
 * doesn't resolve).
 */
export function pathToNodeId(
  rows: readonly BookContentStructureNodeRow[],
  path: readonly number[],
): string | null {
  return resolvePath(rows, path)?.id ?? null;
}
