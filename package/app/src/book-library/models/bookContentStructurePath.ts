import type { ChapterTreeItem } from "@rezics/contract";

export const EMPTY_CHAPTER_ROUTE_ID = "__bookContentStructurePath";

export type ChapterTreeOccurrence = ChapterTreeItem & {
  id: string;
  path: number[];
  occurrenceId: string;
  /**
   * Server-side BookContentStructureNode.id round-tripped from reads. Used by
   * the TOC save flow to identify the existing row; `undefined` for client-
   * created nodes that have not yet been saved.
   */
  nodeId?: string;
  children?: ChapterTreeOccurrence[];
};

export function encodeBookContentStructurePath(path: number[]): string {
  return path.join(".");
}

export function decodeBookContentStructurePath(
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
  return `path:${encodeBookContentStructurePath(path)}`;
}

export function materializedOrPathId(node: ChapterTreeOccurrence): string {
  return node.chapterUnitId ?? node.occurrenceId;
}

export function withBookContentStructureOccurrences(
  nodes: ChapterTreeItem[],
  prefix: number[] = [],
): ChapterTreeOccurrence[] {
  return nodes.map((node, index) => {
    const path = [...prefix, index];
    const { id: serverNodeId, ...rest } = node;
    return {
      ...rest,
      path,
      occurrenceId: occurrenceIdForPath(path),
      id: occurrenceIdForPath(path),
      nodeId: serverNodeId,
      children: node.children
        ? withBookContentStructureOccurrences(node.children, path)
        : undefined,
    };
  });
}

export function findBookContentStructureOccurrence(
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
