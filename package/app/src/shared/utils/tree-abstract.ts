/**
 * This module provides a set of utility functions for working with tree-like data structures.
 * It defines a "flat" representation of a tree and offers functions to build a nested tree from it,
 * flatten it back, and perform common operations like creating, renaming, moving, and deleting nodes.
 *
 * The core data structure is `FlatTree`, which represents a tree using a list of nodes and a map
 * that defines parent-child relationships and sibling order.
 *
 * 本模块提供一组用于处理树状数据结构的工具函数。
 * 它定义了树的「扁平」表示，并提供从中构建嵌套树、再次扁平化，以及创建、重命名、移动、删除节点等常用操作。
 *
 * 核心数据结构是 `FlatTree`，它使用节点列表和一个定义父子关系及兄弟顺序的映射来表示树。
 */

// --- Core Type Definitions ---
// --- 核心类型定义 ---

/**
 * Abstract type for a node's identifier.
 * 节点标识符的抽象类型。
 */
// export type ID = string | number;
export type ID = string;

/**
 * Base interface for any node in a tree. Must have an `id`.
 * 树中任意节点的基础接口。必须有一个 `id`。
 */
export interface NodeBase<IDType = ID> {
  id: IDType;
}

/**
 * A map defining the structure of the tree.
 * Keys are parent node IDs. `null` is used as the key for root nodes.
 * Values are arrays of child node IDs, in order.
 * 定义树结构的映射。
 * 键为父节点 ID。`null` 用作根节点的键。
 * 值为按顺序排列的子节点 ID 数组。
 */
export type OrderMap<IDType = ID> = Map<IDType | null, IDType[]>;

/**
 * The "flat" representation of a tree.
 * It's generic and can work with any node type that extends `NodeBase`.
 * 树的「扁平」表示。
 * 它是泛型的，可用于任何扩展自 `NodeBase` 的节点类型。
 */
export interface FlatTree<T extends NodeBase> {
  /** An array containing all nodes in the tree. 包含树中所有节点的数组。 */
  nodes: T[];
  /** A map that defines the parent-child relationships and order of nodes. 定义节点父子关系及顺序的映射。 */
  orders: OrderMap;
}

/**
 * The nested representation of a tree node, with children directly attached.
 * 树节点的嵌套表示，子节点直接附加在其上。
 */
export type TreeNodeWithChildren<T = NodeBase> = T & {
  children?: Array<TreeNodeWithChildren<T>>;
};

// --- Tree Transformation Functions ---
// --- 树变换函数 ---

/**
 * Builds a nested tree structure (forest) from a flat tree representation.
 * 从扁平树表示构建嵌套树结构（森林）。
 * @param flat The flat tree data. 扁平树数据。
 * @returns An array of root nodes, each with its descendants nested within. 根节点数组，每个根节点内部嵌套其后代。
 * every node need to have at least an empty array children, this enables ChapterArborist to support dragging onto nodes as children.
 * 每个节点至少要有一个空数组 children，这使 ChapterArborist 能够支持将节点拖拽为子节点。
 */
export function buildTree<T extends NodeBase>(
  flat: FlatTree<T>,
  extendFields: Map<any, any> = new Map(),
): Array<TreeNodeWithChildren<T>> {
  const safeFlat = JSON.parse(JSON.stringify(flat));
  const rawNodes = safeFlat.nodes;
  const rawOrders = safeFlat.orders;

  const nodes = Array.isArray(rawNodes)
    ? rawNodes
    : Object.values(rawNodes ?? {});
  const orders =
    rawOrders instanceof Map
      ? rawOrders
      : new Map(Object.entries(rawOrders ?? {}));

  const nodeMap = new Map<T["id"], TreeNodeWithChildren<T>>();
  for (const node of nodes) {
    // extend fields
    // 扩展字段
    if (extendFields.size > 0) {
      nodeMap.set(String(node.id), {
        ...node,
        children: node.children ?? [],
        ...Object.fromEntries(extendFields),
      });
    } else {
      nodeMap.set(String(node.id), { ...node, children: node.children ?? [] });
    }
  }
  // console.log('nodeMap', nodeMap);

  // Build roots
  // 构建根节点
  let rootIds = orders.get(null) || orders.get("null") || [];
  if (rootIds.length === 0) {
    rootIds = Array.from(orders.keys());
  }
  const roots: Array<TreeNodeWithChildren<T>> = [];
  for (const rootId of rootIds) {
    const rootNode = nodeMap.get(String(rootId));
    if (rootNode) {
      rootNode.id = String(rootNode.id);
      roots.push(rootNode);
    }
  }
  // console.log('orders', orders, orders.entries());
  // console.log('roots', roots);

  // Build tree
  // 构建树
  for (const [parentId, childIds] of orders.entries()) {
    if (parentId === null) continue;
    const stringParentId = String(parentId);
    const parentNode = nodeMap.get(stringParentId);
    // console.log("parentNode", parentNode);
    if (!parentNode) continue;

    parentNode.children = [];
    for (const childId of childIds) {
      const childNode = nodeMap.get(String(childId));
      // console.log("childNode", childNode);
      if (childNode) {
        childNode.id = String(childNode.id);
        parentNode.children.push(childNode);
      }
    }
  }
  console.log("roots", roots);

  return roots;
}

/**
 * Flattens a nested tree structure (forest) into a `FlatTree` representation.
 * 将嵌套树结构（森林）扁平化为 `FlatTree` 表示。
 * @param forest An array of root nodes of the nested tree. 嵌套树的根节点数组。
 * @returns The `FlatTree` representation. `FlatTree` 表示。
 */
export function flattenTree<T extends NodeBase>(
  forest: Array<TreeNodeWithChildren<T>>,
  filterFields: string[] = [],
): FlatTree<T> {
  console.log("forest", forest);
  const nodes: T[] = [];
  const orders: OrderMap = new Map();

  function dfs(node: TreeNodeWithChildren<T>, parentId: T["id"] | null) {
    const { children, ...rest } = node;

    // Filter temporary fields
    // 过滤临时字段
    if (filterFields.length > 0) {
      const filteredRest = Object.fromEntries(
        Object.entries(rest).filter(([key]) => !filterFields.includes(key)),
      ) as T;
      nodes.push(filteredRest as T);
    } else {
      nodes.push(rest as T);
    }

    const siblings = orders.get(parentId) || [];
    siblings.push(node.id);
    orders.set(parentId, siblings);

    if (children) {
      // orders.set(node.id, children.map(c => c.id));
      for (const child of children) {
        dfs(child, node.id);
      }
    }
  }

  for (const root of forest) {
    dfs(root, null);
  }

  return { nodes, orders: Object.fromEntries(orders) };
}

// --- Tree Manipulation Functions (Immutable) ---
// --- 树操作函数（不可变） ---

/**
 * Collects all descendant IDs for a given set of node IDs.
 * This is useful for operations like cascading deletes.
 * 收集给定节点 ID 集合的所有后代 ID。
 * 这对级联删除等操作很有用。
 * @param idsToCollect The initial set of node IDs. 初始节点 ID 集合。
 * @param orders The order map of the tree. 树的顺序映射。
 * @returns A Set containing the initial IDs and all of their descendants. 包含初始 ID 及其所有后代的 Set。
 */
function collectDescendants(idsToCollect: ID[], orders: OrderMap): Set<ID> {
  const collected = new Set(idsToCollect);
  const queue = [...idsToCollect];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = orders.get(currentId) || [];
    for (const childId of children) {
      if (!collected.has(childId)) {
        collected.add(childId);
        queue.push(childId);
      }
    }
  }

  return collected;
}

/**
 * Adds a new node to the tree.
 * 向树中添加一个新节点。
 * @param tree The original flat tree. 原始扁平树。
 * @param newNode The node to add. 要添加的节点。
 * @param parentId The ID of the parent node. Use `null` for root nodes. 父节点 ID。根节点使用 `null`。
 * @param index The position at which to insert the new node among its siblings. Defaults to the end. 在兄弟节点中插入新节点的位置。默认插入末尾。
 * @returns A new `FlatTree` instance with the node added. 添加了节点的新 `FlatTree` 实例。
 */
export function createNode<T extends NodeBase>(
  tree: FlatTree<T>,
  newNode: T,
  parentId: T["id"] | null,
  index?: number,
): FlatTree<T> {
  const newNodes = [...tree.nodes, newNode];
  const newOrders: OrderMap = new Map(tree.orders);
  const siblings = [...(newOrders.get(parentId) || [])];

  const insertionIndex = index === undefined ? siblings.length : index;
  siblings.splice(insertionIndex, 0, newNode.id);
  newOrders.set(parentId, siblings);

  return { nodes: newNodes, orders: newOrders };
}

/**
 * Updates a node in the tree.
 * 更新树中的一个节点。
 * @param tree The original flat tree. 原始扁平树。
 * @param nodeId The ID of the node to update. 要更新的节点 ID。
 * @param updates A partial object with the properties of the node to update. 包含要更新的节点属性的部分对象。
 * @returns A new `FlatTree` instance with the node updated. 更新了节点的新 `FlatTree` 实例。
 */
export function updateNode<T extends NodeBase>(
  tree: FlatTree<T>,
  nodeId: T["id"],
  updates: Partial<Omit<T, "id">>,
): FlatTree<T> {
  const newNodes = tree.nodes.map((node) =>
    node.id === nodeId ? { ...node, ...updates } : node,
  );
  return { ...tree, nodes: newNodes };
}

/**
 * Moves a node to a new parent and position.
 * 将节点移动到新的父节点和位置。
 * @param tree The original flat tree. 原始扁平树。
 * @param nodeId The ID of the node to move. 要移动的节点 ID。
 * @param newParentId The ID of the new parent. Use `null` for root level. 新父节点 ID。根层级使用 `null`。
 * @param newIndex The new position among its new siblings. 在新兄弟节点中的新位置。
 * @returns A new `FlatTree` instance with the node moved. 移动了节点的新 `FlatTree` 实例。
 */
export function moveNode<T extends NodeBase>(
  tree: FlatTree<T>,
  nodeId: T["id"],
  newParentId: T["id"] | null,
  newIndex: number,
): FlatTree<T> {
  const newOrders: OrderMap = new Map();
  let _oldParentId: T["id"] | null = null;

  // Find old parent and create new order map without the moving node
  // 找到旧父节点，并创建一个不含被移动节点的新顺序映射
  for (const [pId, children] of tree.orders.entries()) {
    const newChildren = children.filter((cId) => {
      if (cId === nodeId) {
        _oldParentId = pId;
        return false;
      }
      return true;
    });
    if (newChildren.length > 0) {
      newOrders.set(pId, newChildren);
    }
  }

  // Add to new parent
  // Handle case where node is moved within the same parent
  // 添加到新父节点
  // 处理节点在同一父节点内移动的情况
  const targetSiblings = [...(newOrders.get(newParentId) || [])];
  targetSiblings.splice(newIndex, 0, nodeId);
  newOrders.set(newParentId, targetSiblings);

  return { ...tree, orders: newOrders };
}

/**
 * Deletes nodes and all their descendants from the tree.
 * 从树中删除节点及其所有后代。
 * @param tree The original flat tree. 原始扁平树。
 * @param nodeIds The IDs of the nodes to delete. 要删除的节点 ID。
 * @returns A new `FlatTree` instance with the nodes removed. 移除了节点的新 `FlatTree` 实例。
 */
export function deleteNodes<T extends NodeBase>(
  tree: FlatTree<T>,
  nodeIds: T["id"][],
): FlatTree<T> {
  const idsToDelete = collectDescendants(nodeIds, tree.orders);

  const newNodes = tree.nodes.filter((node) => !idsToDelete.has(node.id));

  const newOrders: OrderMap = new Map();
  for (const [parentId, children] of tree.orders.entries()) {
    if (idsToDelete.has(parentId as T["id"])) continue;
    const newChildren = children.filter((childId) => !idsToDelete.has(childId));
    if (newChildren.length > 0) {
      newOrders.set(parentId, newChildren);
    }
  }

  return { nodes: newNodes, orders: newOrders };
}
