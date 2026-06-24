import type { BookContentStructureItem } from "@rezics/contract";

export type BookContentStructureOccurrence = BookContentStructureItem & {
  id: string;
  path: number[];
  occurrenceId: string;
  /**
   * Server-side BookContentStructureNode.id round-tripped from reads. Used by
   * the TOC save flow to identify the existing row, and by reading navigation to
   * address the node via `/book/:bookId/node/:nodeId`; `undefined` for client-
   * created nodes that have not yet been saved.
   */
  nodeId?: string;
  children?: BookContentStructureOccurrence[];
};

export function occurrenceIdForPath(path: number[]): string {
  return `path:${path.join(".")}`;
}

export function materializedOrPathId(
  node: BookContentStructureOccurrence,
): string {
  return contentUnitIdForNode(node) ?? node.occurrenceId;
}

export function contentUnitIdForNode(
  node: Pick<BookContentStructureItem, "contentUnitId">,
): string | undefined {
  return node.contentUnitId;
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
