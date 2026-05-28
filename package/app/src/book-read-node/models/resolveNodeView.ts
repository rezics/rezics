import type { ContentStructureItem } from "@rezics/contract";

export type NodeViewState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "deleted"; node: ContentStructureItem }
  | { kind: "empty"; node: ContentStructureItem; path: number[] }
  | {
      kind: "reading";
      node: ContentStructureItem;
      path: number[];
      contentUnitId: string;
    };

export function findNodeById(
  nodes: readonly ContentStructureItem[] | undefined,
  nodeId: string,
  trail: number[] = [],
): { node: ContentStructureItem; path: number[] } | null {
  if (!nodes) return null;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;
    const next = [...trail, i];
    if (node.id === nodeId) return { node, path: next };
    if (node.children) {
      const found = findNodeById(node.children, nodeId, next);
      if (found) return found;
    }
  }
  return null;
}

export function resolveNodeView(input: {
  nodes: readonly ContentStructureItem[] | undefined;
  isLoading: boolean;
  nodeId: string;
  chapterUnitDeleted?: boolean;
}): NodeViewState {
  if (input.isLoading) return { kind: "loading" };
  const hit = findNodeById(input.nodes, input.nodeId);
  if (!hit) return { kind: "not-found" };
  const { node, path } = hit;
  if (input.chapterUnitDeleted) {
    return { kind: "deleted", node };
  }
  if (!node.contentUnitId) {
    return { kind: "empty", node, path };
  }
  return { kind: "reading", node, path, contentUnitId: node.contentUnitId };
}
