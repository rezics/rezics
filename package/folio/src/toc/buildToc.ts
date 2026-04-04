import type { FlatChapter, FolioNode } from '../types';

export type TocEntry =
  | { kind: 'branch'; node: FolioNode; depth: number }
  | { kind: 'leaf'; node: FolioNode; chapter: FlatChapter };

export function buildToc(
  nodes: FolioNode[],
  flatChapters: FlatChapter[],
): TocEntry[] {
  const flatMap = new Map(flatChapters.map((f) => [f.node.id, f]));
  const entries: TocEntry[] = [];

  function walk(nodes: FolioNode[], depth: number) {
    for (const node of nodes) {
      if (node.children) {
        entries.push({ kind: 'branch', node, depth });
        walk(node.children, depth + 1);
      } else {
        const chapter = flatMap.get(node.id);
        if (chapter) {
          entries.push({ kind: 'leaf', node, chapter });
        }
      }
    }
  }

  walk(nodes, 0);
  return entries;
}
