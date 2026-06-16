export interface NestedTreeNode {
  id: string | number;
  children?: NestedTreeNode[];
}

export interface RemovedNode<TNode> {
  node: TNode;
  parentId: string | number | null;
  index: number;
}

export function ensureTreeChildren<TNode extends NestedTreeNode>(
  nodes: readonly TNode[],
): TNode[] {
  return nodes.map((node) => ({
    ...node,
    children: ensureTreeChildren((node.children ?? []) as TNode[]),
  }));
}

export function stripEmptyTreeChildren<TNode extends NestedTreeNode>(
  nodes: readonly TNode[],
): TNode[] {
  return nodes.map((node) => {
    const children = stripEmptyTreeChildren((node.children ?? []) as TNode[]);
    const next = { ...node };
    if (children.length > 0) {
      next.children = children;
    } else {
      delete next.children;
    }
    return next;
  });
}

export function removeTreeNodes<TNode extends NestedTreeNode>(
  nodes: readonly TNode[],
  ids: ReadonlySet<string>,
  parentId: string | number | null = null,
  removed: RemovedNode<TNode>[] = [],
): TNode[] {
  const next: TNode[] = [];
  nodes.forEach((node, index) => {
    if (ids.has(String(node.id))) {
      removed.push({ node, parentId, index });
      return;
    }
    next.push({
      ...node,
      children: removeTreeNodes(
        (node.children ?? []) as TNode[],
        ids,
        node.id,
        removed,
      ),
    });
  });
  return next;
}

export function insertTreeNodes<TNode extends NestedTreeNode>(
  nodes: readonly TNode[],
  parentId: string | number | null,
  index: number,
  inserted: readonly TNode[],
): TNode[] {
  if (parentId === null) {
    const next = [...nodes] as TNode[];
    next.splice(index, 0, ...inserted);
    return next;
  }

  return nodes.map((node) => {
    if (String(node.id) === String(parentId)) {
      const children = [...((node.children ?? []) as TNode[])];
      children.splice(index, 0, ...inserted);
      return { ...node, children };
    }
    return {
      ...node,
      children: insertTreeNodes(
        (node.children ?? []) as TNode[],
        parentId,
        index,
        inserted,
      ),
    };
  }) as TNode[];
}

export function moveTreeNodes<TNode extends NestedTreeNode>(
  nodes: readonly TNode[],
  ids: readonly string[],
  parentId: string | number | null,
  index: number,
): TNode[] {
  const removed: RemovedNode<TNode>[] = [];
  const withoutMoved = removeTreeNodes(nodes, new Set(ids), null, removed);
  return insertTreeNodes(
    withoutMoved,
    parentId,
    index,
    removed.map((entry) => entry.node),
  );
}

export function collectDescendantIds<TNode extends NestedTreeNode>(
  node: TNode,
): Set<string> {
  const ids = new Set<string>();
  const visit = (current: TNode) => {
    for (const child of (current.children ?? []) as TNode[]) {
      ids.add(String(child.id));
      visit(child);
    }
  };
  visit(node);
  return ids;
}
