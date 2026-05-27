import type { BookContentStructureItem } from "@rezics/contract";

export const EMPTY_CHAPTER_ROUTE_ID = "__bookContentStructurePath";

export type BookContentStructureOccurrence = BookContentStructureItem & {
  id: string;
  path: number[];
  occurrenceId: string;
  /**
   * Server-side BookContentStructureNode.id round-tripped from reads. Used by
   * the TOC save flow to identify the existing row; `undefined` for client-
   * created nodes that have not yet been saved.
   */
  nodeId?: string;
  children?: BookContentStructureOccurrence[];
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

export function materializedOrPathId(
  node: BookContentStructureOccurrence,
): string {
  return contentUnitIdForNode(node) ?? node.occurrenceId;
}

export function contentUnitIdForNode(
  node: Pick<BookContentStructureItem, "contentUnitId" | "chapterUnitId">,
): string | undefined {
  return node.contentUnitId ?? node.chapterUnitId;
}

export function withBookContentStructureOccurrences(
  nodes: BookContentStructureItem[],
  prefix: number[] = [],
): BookContentStructureOccurrence[] {
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
  nodes: BookContentStructureOccurrence[],
  path: number[],
): BookContentStructureOccurrence | null {
  let current = nodes;
  let node: BookContentStructureOccurrence | undefined;
  for (const segment of path) {
    node = current[segment];
    if (!node) return null;
    current = node.children ?? [];
  }
  return node ?? null;
}
