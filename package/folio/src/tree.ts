import type { FlatChapter, FolioNode } from "./types";

export function flattenTree(nodes: FolioNode[]): FlatChapter[] {
  const result: FlatChapter[] = [];
  let leafIndex = 0;

  function walk(nodes: FolioNode[], depth: number, path: number[]) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const currentPath = [...path, i];

      if (node.fetch) {
        result.push({ index: leafIndex++, node, depth, path: currentPath });
      }

      if (node.children) {
        walk(node.children, depth + 1, currentPath);
      }
    }
  }

  walk(nodes, 0, []);
  return result;
}
