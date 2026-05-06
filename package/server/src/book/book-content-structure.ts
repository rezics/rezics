import type { ChapterTreeItem, ContentRating } from "@rezics/contract";

export class BookContentStructurePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookContentStructurePathError";
  }
}

export type BookContentStructureNodeUpdate = (
  node: ChapterTreeItem,
) => ChapterTreeItem;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

export function normalizeBookContentStructureValue(
  value: unknown,
): ChapterTreeItem[] {
  if (Array.isArray(value)) {
    return value.map((node) => normalizeBookContentStructureNode(node));
  }
  return [];
}

export function normalizeBookContentStructureNode(
  value: unknown,
): ChapterTreeItem {
  const source = isObject(value) ? value : {};
  const node: ChapterTreeItem = {
    title: typeof source.title === "string" ? source.title : "",
  };

  const chapterUnitId =
    typeof source.chapterUnitId === "string" ? source.chapterUnitId : undefined;
  if (chapterUnitId) node.chapterUnitId = chapterUnitId;
  if (typeof source.noContent === "boolean") node.noContent = source.noContent;
  if (typeof source.rating === "string") {
    node.rating = source.rating as ContentRating;
  }
  if (Array.isArray(source.children)) {
    node.children = source.children.map((child) =>
      normalizeBookContentStructureNode(child),
    );
  }

  return node;
}

export function getBookContentStructureNode(
  nodes: ChapterTreeItem[],
  path: number[],
): ChapterTreeItem | null {
  let currentNodes = nodes;
  let node: ChapterTreeItem | undefined;

  for (const segment of validateBookContentStructurePath(path)) {
    node = currentNodes[segment];
    if (!node) return null;
    currentNodes = node.children ?? [];
  }

  return node ?? null;
}

export function updateBookContentStructureNode(
  nodes: ChapterTreeItem[],
  path: number[],
  update: BookContentStructureNodeUpdate,
): ChapterTreeItem[] {
  validateBookContentStructurePath(path);
  if (path.length === 0) {
    throw new BookContentStructurePathError(
      "Cannot update the BookContentStructure forest root",
    );
  }

  const [head, ...tail] = path;
  if (head === undefined || head >= nodes.length) {
    throw new BookContentStructurePathError(
      `BookContentStructure path does not resolve`,
    );
  }

  return nodes.map((node, i) => {
    if (i !== head) return node;
    if (tail.length === 0) return update(node);
    return {
      ...node,
      children: updateBookContentStructureNode(
        node.children ?? [],
        tail,
        update,
      ),
    };
  });
}
