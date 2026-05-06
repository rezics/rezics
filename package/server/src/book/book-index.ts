import type { ChapterTreeItem, ContentRating } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";

export class BookIndexPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookIndexPathError";
  }
}

export type BookIndexNodeUpdate = (node: ChapterTreeItem) => ChapterTreeItem;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseBookIndexPath(path: string | number[]): number[] {
  if (Array.isArray(path)) return validateBookIndexPath(path);
  if (path.trim() === "") return [];
  return validateBookIndexPath(
    path.split(".").map((part) => {
      const index = Number(part);
      if (!Number.isInteger(index)) {
        throw new BookIndexPathError(`Invalid BookIndex path segment: ${part}`);
      }
      return index;
    }),
  );
}

export function validateBookIndexPath(path: number[]): number[] {
  for (const segment of path) {
    if (!Number.isInteger(segment) || segment < 0) {
      throw new BookIndexPathError(
        `BookIndex path segments must be non-negative integers`,
      );
    }
  }
  return path;
}

export function normalizeBookIndexValue(value: unknown): ChapterTreeItem[] {
  if (Array.isArray(value)) return value.map((node) => normalizeBookIndexNode(node));
  return [];
}

export function normalizeBookIndexNode(
  value: unknown,
  options: { readLegacyId?: boolean } = {},
): ChapterTreeItem {
  const source = isObject(value) ? value : {};
  const node: ChapterTreeItem = {
    title: typeof source.title === "string" ? source.title : "",
  };

  const chapterUnitId =
    typeof source.chapterUnitId === "string"
      ? source.chapterUnitId
      : options.readLegacyId && typeof source.id === "string"
        ? source.id
        : undefined;
  if (chapterUnitId) node.chapterUnitId = chapterUnitId;
  if (typeof source.noContent === "boolean") node.noContent = source.noContent;
  if (typeof source.rating === "string") {
    node.rating = source.rating as ContentRating;
  }
  if (Array.isArray(source.children)) {
    node.children = source.children.map((child) =>
      normalizeBookIndexNode(child, options),
    );
  }

  return node;
}

export function normalizeLegacyBookIndexValue(value: unknown): ChapterTreeItem[] {
  if (Array.isArray(value)) {
    return value.map((node) => normalizeBookIndexNode(node, { readLegacyId: true }));
  }
  return [];
}

export function getBookIndexNode(
  index: ChapterTreeItem[],
  path: number[],
): ChapterTreeItem | null {
  let nodes = index;
  let node: ChapterTreeItem | undefined;

  for (const segment of validateBookIndexPath(path)) {
    node = nodes[segment];
    if (!node) return null;
    nodes = node.children ?? [];
  }

  return node ?? null;
}

export function updateBookIndexNode(
  index: ChapterTreeItem[],
  path: number[],
  update: BookIndexNodeUpdate,
): ChapterTreeItem[] {
  validateBookIndexPath(path);
  if (path.length === 0) {
    throw new BookIndexPathError("Cannot update the BookIndex forest root");
  }

  const [head, ...tail] = path;
  if (head === undefined || head >= index.length) {
    throw new BookIndexPathError(`BookIndex path does not resolve`);
  }

  return index.map((node, i) => {
    if (i !== head) return node;
    if (tail.length === 0) return update(node);
    return {
      ...node,
      children: updateBookIndexNode(node.children ?? [], tail, update),
    };
  });
}

export async function normalizeLegacyBookIndex(
  index: unknown,
  tx: Pick<Prisma.TransactionClient, "unit">,
): Promise<ChapterTreeItem[]> {
  const unitIds = new Set<string>();
  const normalized = normalizeBookIndexValue(index);

  function collect(nodes: ChapterTreeItem[]) {
    for (const node of nodes) {
      if (node.chapterUnitId) unitIds.add(node.chapterUnitId);
      collect(node.children ?? []);
    }
  }
  collect(normalized);

  if (unitIds.size === 0) return normalized;

  const materializedUnits = await tx.unit.findMany({
    where: { id: { in: [...unitIds] } },
    select: { id: true },
  });
  const validIds = new Set(materializedUnits.map((unit) => unit.id));

  function stripUnknown(nodes: ChapterTreeItem[]): ChapterTreeItem[] {
    return nodes.map((node) => {
      const next: ChapterTreeItem = { ...node };
      if (next.chapterUnitId && !validIds.has(next.chapterUnitId)) {
        delete next.chapterUnitId;
      }
      if (next.children) next.children = stripUnknown(next.children);
      return next;
    });
  }

  return stripUnknown(normalized);
}

export async function migrateLegacyBookIndexIds(
  index: unknown,
  tx: Pick<Prisma.TransactionClient, "unit">,
): Promise<ChapterTreeItem[]> {
  const normalized = normalizeLegacyBookIndexValue(index);
  return normalizeLegacyBookIndex(normalized, tx);
}
