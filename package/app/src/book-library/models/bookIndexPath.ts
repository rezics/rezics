import type { ChapterTreeItem } from "@rezics/contract";

export const EMPTY_CHAPTER_ROUTE_ID = "__bookIndexPath";

export type ChapterTreeOccurrence = ChapterTreeItem & {
  id: string;
  path: number[];
  occurrenceId: string;
  children?: ChapterTreeOccurrence[];
};

export function encodeBookIndexPath(path: number[]): string {
  return path.join(".");
}

export function decodeBookIndexPath(
  value: string | undefined,
): number[] | null {
  if (!value) return null;
  if (value.trim() === "") return [];
  const path = value.split(".").map((segment) => Number(segment));
  return path.every((segment) => Number.isInteger(segment) && segment >= 0)
    ? path
    : null;
}

export function occurrenceIdForPath(path: number[]): string {
  return `path:${encodeBookIndexPath(path)}`;
}

export function materializedOrPathId(node: ChapterTreeOccurrence): string {
  return node.chapterUnitId ?? node.occurrenceId;
}

export function withBookIndexOccurrences(
  nodes: ChapterTreeItem[],
  prefix: number[] = [],
): ChapterTreeOccurrence[] {
  return nodes.map((node, index) => {
    const path = [...prefix, index];
    return {
      ...node,
      path,
      occurrenceId: occurrenceIdForPath(path),
      id: occurrenceIdForPath(path),
      children: node.children
        ? withBookIndexOccurrences(node.children, path)
        : undefined,
    };
  });
}

export function findBookIndexOccurrence(
  nodes: ChapterTreeOccurrence[],
  path: number[],
): ChapterTreeOccurrence | null {
  let current = nodes;
  let node: ChapterTreeOccurrence | undefined;
  for (const segment of path) {
    node = current[segment];
    if (!node) return null;
    current = node.children ?? [];
  }
  return node ?? null;
}
