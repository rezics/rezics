import * as EffectArray from "effect/Array";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";

export interface BaseNode {
  id: string | number;
}

interface TreeNode extends BaseNode {
  title: string; // Required title to match Chapter type — 必填 title，与 Chapter 类型匹配
  children?: TreeNode[];
}

/**
 * Tree manipulation utilities.
 * 树操作工具。
 */

// Helper: safely convert id to string for comparison.
// 辅助函数：安全地将 id 转换为字符串进行比较。
const normalizeId = (id: string | number): string => String(id);

// Helper: check whether two ids are equal.
// 辅助函数：检查两个 id 是否相等。
const idsEqual = (id1: string | number, id2: string | number): boolean =>
  normalizeId(id1) === normalizeId(id2);

// Helper: find a node's index within an array.
// 辅助函数：在数组中查找节点索引。
const findNodeIndex = (
  nodes: TreeNode[],
  targetId: string | number,
): Option.Option<number> =>
  EffectArray.findFirstIndex(nodes, (node: TreeNode) =>
    idsEqual(node.id, targetId),
  );

// Helper: safely insert elements at a given position.
// 辅助函数：安全地在指定位置插入元素。
const insertAt =
  <T>(index: number, items: T[]) =>
  (array: T[]): T[] => {
    const [before, after] = EffectArray.splitAt(array, index);
    return [...before, ...items, ...after];
  };

// Helper: deep-clone a node (avoid shared references).
// 辅助函数：深拷贝节点（避免引用共享）。
const _cloneNode = (node: TreeNode): TreeNode => {
  const { children, ...rest } = node;
  if (children) {
    return { ...rest, id: node.id, children: children.map(_cloneNode) };
  }
  return { ...rest, id: node.id };
};

/**
 * Find and remove nodes with the given IDs.
 * 查找并移除指定 ID 的节点。
 */
/**
 * Within an id/children-structured tree, remove the nodes listed in `ids`.
 * 在一棵 id/children 结构的树中，移除 ids 里的节点。
 * @param tree    Original tree。原始树。
 * @param ids     List of node ids to remove。要移除的节点 id 列表。
 * @param removed Pass an empty array; the function pushes every removed node into it。传入一个空数组，函数会把所有被删的节点 push 到这里。
 * @returns       New tree (without the removed nodes)。新树（不含被移除节点）。
 */
export function findAndRemove(
  tree: TreeNode[],
  ids: (string | number)[],
  removed: TreeNode[],
): any[] {
  return tree.filter((node) => {
    const currentNodeId = String(node.id);
    if (ids.includes(currentNodeId)) {
      removed.push(JSON.parse(JSON.stringify(node)));
      return false;
    }
    if (node.children) {
      node.children = findAndRemove(node.children, ids, removed);
    }
    return true;
  });
}

/**
 * Recursively finds the target parent node and inserts given nodes
 * into its children array at the specified index.
 * 递归查找目标父节点，并在指定索引处把给定节点插入其 children 数组。
 *
 * @param tree - Current subtree。当前子树。
 * @param parentId - Target parent id (null means root)。目标父节点 id（null 表示根）。
 * @param index - Insert position within the parent's children。在父节点 children 中的插入位置。
 * @param nodes - Nodes to insert。要插入的节点。
 * @returns Updated subtree。更新后的子树。
 */
export function findAndInsert(
  tree: TreeNode[],
  parentId: string | null,
  index: number,
  nodes: TreeNode[],
): TreeNode[] {
  // Insert at root level.
  // 在根层级插入。
  if (parentId === null) {
    const next = [...tree];
    next.splice(index, 0, ...nodes);
    return next;
  }

  return tree.map((node) => {
    if (node.id === parentId) {
      const children = node.children ? [...node.children] : [];
      children.splice(index, 0, ...nodes);

      return {
        ...node,
        children,
      };
    }

    if (node.children) {
      return {
        ...node,
        children: findAndInsert(node.children, parentId, index, nodes),
      };
    }

    return node;
  });
}

/**
 * Find a node and edit its title.
 * 查找并编辑节点标题。
 */
export const findAndEdit = (
  tree: ReadonlyArray<TreeNode>,
  id: string | number,
  newName: string,
): TreeNode[] => {
  const processNode = (node: TreeNode): TreeNode => {
    if (idsEqual(node.id, id)) {
      return { ...node, title: newName } as TreeNode;
    }

    if (node.children) {
      return { ...node, children: node.children.map(processNode) };
    }

    return node;
  };

  return tree.map(processNode);
};

/**
 * Find and delete nodes with the given IDs.
 * 查找并删除指定 ID 的节点。
 */
export const findAndDelete = (
  tree: ReadonlyArray<TreeNode>,
  ids: ReadonlyArray<string | number>,
): TreeNode[] => {
  const idsSet = new Set(ids.map(normalizeId));

  const shouldKeep = (node: TreeNode): boolean =>
    !idsSet.has(normalizeId(node.id));

  const processNode = (node: TreeNode): TreeNode => {
    if (node.children) {
      const filteredChildren = pipe(
        node.children,
        EffectArray.filter(shouldKeep),
        EffectArray.map(processNode),
      );
      return { ...node, children: filteredChildren };
    }
    return node;
  };

  return pipe(
    tree,
    EffectArray.filter(shouldKeep),
    EffectArray.map(processNode),
  );
};

/**
 * Find a node and append a child to it.
 * 查找并添加子节点。
 */
export const findAndAddChild = (
  tree: ReadonlyArray<TreeNode>,
  parentId: string | number,
  newNode: TreeNode,
): TreeNode[] => {
  const processNode = (node: TreeNode): TreeNode => {
    if (idsEqual(node.id, parentId)) {
      const children = node.children ? [...node.children, newNode] : [newNode];
      return { ...node, children };
    }

    if (node.children) {
      return { ...node, children: node.children.map(processNode) };
    }

    return node;
  };

  return tree.map(processNode);
};

/**
 * Insert a sibling node after the target node.
 * 在目标节点之后插入同级节点。
 */
export const insertSiblingAfter = (
  tree: ReadonlyArray<TreeNode>,
  targetId: string | number,
  newNode: TreeNode,
): TreeNode[] => {
  let processed = false;

  const processNodes = (nodes: ReadonlyArray<TreeNode>): TreeNode[] => {
    if (processed) return [...nodes];

    return pipe(
      findNodeIndex([...nodes], targetId),
      Option.match({
        onNone: () =>
          nodes.map((node) =>
            node.children
              ? { ...node, children: processNodes(node.children) }
              : node,
          ),
        onSome: (index: number) => {
          processed = true;
          return insertAt(index + 1, [newNode])([...nodes]);
        },
      }),
    );
  };

  return processNodes(tree);
};

export function attachFirstOrphanToParent(treeData: any[], parentId: string) {
  // Deep clone.
  // 深拷贝。
  const data = treeData.map((n) => ({ ...n }));

  const orphanIndex = data.findIndex(
    (n) =>
      !n.parentId &&
      (!n.children || n.children.length === 0) &&
      n.id !== parentId,
  );

  if (orphanIndex === -1) return data;

  const orphan = data[orphanIndex];
  const parent = data.find((n) => n.id === parentId);

  if (!parent) return data;

  data.splice(orphanIndex, 1);

  orphan.parentId = parentId;

  parent.children = parent.children ? [...parent.children] : [];
  parent.children.push(orphan);

  return data;
}

/**
 * Move a node to the first position among its siblings.
 * 将节点移动到同级最前。
 */
export const moveSiblingFirst = (
  tree: ReadonlyArray<TreeNode>,
  targetId: string | number,
): TreeNode[] => {
  let processed = false;

  const processNodes = (nodes: ReadonlyArray<TreeNode>): TreeNode[] => {
    if (processed) return [...nodes];

    return pipe(
      findNodeIndex([...nodes], targetId),
      Option.match({
        onNone: () =>
          nodes.map((node) =>
            node.children
              ? { ...node, children: processNodes(node.children) }
              : node,
          ),
        onSome: (index: number) => {
          processed = true;
          const nodeArray = [...nodes];
          const targetNode = nodeArray[index]!;
          const otherNodes = nodeArray.filter(
            (_: TreeNode, i: number) => i !== index,
          );
          return [targetNode, ...otherNodes];
        },
      }),
    );
  };

  return processNodes(tree);
};

/**
 * Move a node to the last position among its siblings.
 * 将节点移动到同级最后。
 */
export const moveSiblingLast = (
  tree: ReadonlyArray<TreeNode>,
  targetId: string | number,
): TreeNode[] => {
  let processed = false;

  const processNodes = (nodes: ReadonlyArray<TreeNode>): TreeNode[] => {
    if (processed) return [...nodes];

    return pipe(
      findNodeIndex([...nodes], targetId),
      Option.match({
        onNone: () =>
          nodes.map((node) =>
            node.children
              ? { ...node, children: processNodes(node.children) }
              : node,
          ),
        onSome: (index: number) => {
          processed = true;
          const nodeArray = [...nodes];
          const targetNode = nodeArray[index]!;
          const otherNodes = nodeArray.filter(
            (_: TreeNode, i: number) => i !== index,
          );
          return [...otherNodes, targetNode];
        },
      }),
    );
  };

  return processNodes(tree);
};
