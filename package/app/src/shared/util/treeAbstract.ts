/**
 * This module provides a set of utility functions for working with tree-like data structures.
 * It defines a "flat" representation of a tree and offers functions to build a nested tree from it,
 * flatten it back, and perform common operations like creating, renaming, moving, and deleting nodes.
 *
 * The core data structure is `FlatTree`, which represents a tree using a list of nodes and a map
 * that defines parent-child relationships and sibling order.
 */

// --- Core Type Definitions ---

/**
 * Abstract type for a node's identifier.
 */
// export type ID = string | number;
export type ID = string;

/**
 * Base interface for any node in a tree. Must have an `id`.
 */
export interface NodeBase<IDType = ID> {
  id: IDType;
}

/**
 * A map defining the structure of the tree.
 * Keys are parent node IDs. `null` is used as the key for root nodes.
 * Values are arrays of child node IDs, in order.
 */
export type OrderMap<IDType = ID> = Map<IDType | null, IDType[]>;

/**
 * The "flat" representation of a tree.
 * It's generic and can work with any node type that extends `NodeBase`.
 */
export interface FlatTree<T extends NodeBase> {
  /** An array containing all nodes in the tree. */
  nodes: T[];
  /** A map that defines the parent-child relationships and order of nodes. */
  orders: OrderMap;
}

/**
 * The nested representation of a tree node, with children directly attached.
 */
export type TreeNodeWithChildren<T = NodeBase> = T & {
  children?: Array<TreeNodeWithChildren<T>>;
};

// --- Tree Transformation Functions ---

/**
 * Builds a nested tree structure (forest) from a flat tree representation.
 * @param flat The flat tree data.
 * @returns An array of root nodes, each with its descendants nested within.
 * every node need to have at least an empty array children, this enables ChapterArborist to support dragging onto nodes as children.
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

  const nodeMap = new Map<T['id'], TreeNodeWithChildren<T>>();
  for (const node of nodes) {
    // extend fields
    if (extendFields.size > 0) {
      nodeMap.set(String(node.id), {
        ...node,
        children: node.children ?? [],
        ...Object.fromEntries(extendFields),
      });
    } else {
      nodeMap.set(String(node.id), {...node, children: node.children ?? []});
    }
  }
  // console.log('nodeMap', nodeMap);

  // Build roots
  let rootIds = orders.get(null) || orders.get('null') || [];
  if (rootIds.length === 0) {
    rootIds = Array.from(orders.keys());
  }
  const roots: Array<TreeNodeWithChildren<T>> = [];
  for (const rootId of rootIds) {
    let rootNode = nodeMap.get(String(rootId));
    if (rootNode) {
      rootNode.id = String(rootNode.id);
      roots.push(rootNode);
    }
  }
  // console.log('orders', orders, orders.entries());
  // console.log('roots', roots);

  // Build tree
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
  console.log('roots', roots);

  return roots;
}

/**
 * Flattens a nested tree structure (forest) into a `FlatTree` representation.
 * @param forest An array of root nodes of the nested tree.
 * @returns The `FlatTree` representation.
 */
export function flattenTree<T extends NodeBase>(
  forest: Array<TreeNodeWithChildren<T>>,
  filterFields: string[] = [],
): FlatTree<T> {
  console.log('forest', forest);
  const nodes: T[] = [];
  const orders: OrderMap = new Map();

  function dfs(node: TreeNodeWithChildren<T>, parentId: T['id'] | null) {
    const {children, ...rest} = node;

    // Filter temporary fields
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

  return {nodes, orders: Object.fromEntries(orders)};
}

// --- Tree Manipulation Functions (Immutable) ---

/**
 * Collects all descendant IDs for a given set of node IDs.
 * This is useful for operations like cascading deletes.
 * @param idsToCollect The initial set of node IDs.
 * @param orders The order map of the tree.
 * @returns A Set containing the initial IDs and all of their descendants.
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
 * @param tree The original flat tree.
 * @param newNode The node to add.
 * @param parentId The ID of the parent node. Use `null` for root nodes.
 * @param index The position at which to insert the new node among its siblings. Defaults to the end.
 * @returns A new `FlatTree` instance with the node added.
 */
export function createNode<T extends NodeBase>(
  tree: FlatTree<T>,
  newNode: T,
  parentId: T['id'] | null,
  index?: number,
): FlatTree<T> {
  const newNodes = [...tree.nodes, newNode];
  const newOrders: OrderMap = new Map(tree.orders);
  const siblings = [...(newOrders.get(parentId) || [])];

  const insertionIndex = index === undefined ? siblings.length : index;
  siblings.splice(insertionIndex, 0, newNode.id);
  newOrders.set(parentId, siblings);

  return {nodes: newNodes, orders: newOrders};
}

/**
 * Updates a node in the tree.
 * @param tree The original flat tree.
 * @param nodeId The ID of the node to update.
 * @param updates A partial object with the properties of the node to update.
 * @returns A new `FlatTree` instance with the node updated.
 */
export function updateNode<T extends NodeBase>(
  tree: FlatTree<T>,
  nodeId: T['id'],
  updates: Partial<Omit<T, 'id'>>,
): FlatTree<T> {
  const newNodes = tree.nodes.map(node =>
    node.id === nodeId ? {...node, ...updates} : node,
  );
  return {...tree, nodes: newNodes};
}

/**
 * Moves a node to a new parent and position.
 * @param tree The original flat tree.
 * @param nodeId The ID of the node to move.
 * @param newParentId The ID of the new parent. Use `null` for root level.
 * @param newIndex The new position among its new siblings.
 * @returns A new `FlatTree` instance with the node moved.
 */
export function moveNode<T extends NodeBase>(
  tree: FlatTree<T>,
  nodeId: T['id'],
  newParentId: T['id'] | null,
  newIndex: number,
): FlatTree<T> {
  const newOrders: OrderMap = new Map();
  let oldParentId: T['id'] | null = null;

  // Find old parent and create new order map without the moving node
  for (const [pId, children] of tree.orders.entries()) {
    const newChildren = children.filter(cId => {
      if (cId === nodeId) {
        oldParentId = pId;
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
  const targetSiblings = [...(newOrders.get(newParentId) || [])];
  targetSiblings.splice(newIndex, 0, nodeId);
  newOrders.set(newParentId, targetSiblings);

  return {...tree, orders: newOrders};
}

/**
 * Deletes nodes and all their descendants from the tree.
 * @param tree The original flat tree.
 * @param nodeIds The IDs of the nodes to delete.
 * @returns A new `FlatTree` instance with the nodes removed.
 */
export function deleteNodes<T extends NodeBase>(
  tree: FlatTree<T>,
  nodeIds: T['id'][],
): FlatTree<T> {
  const idsToDelete = collectDescendants(nodeIds, tree.orders);

  const newNodes = tree.nodes.filter(node => !idsToDelete.has(node.id));

  const newOrders: OrderMap = new Map();
  for (const [parentId, children] of tree.orders.entries()) {
    if (idsToDelete.has(parentId as T['id'])) continue;
    const newChildren = children.filter(childId => !idsToDelete.has(childId));
    if (newChildren.length > 0) {
      newOrders.set(parentId, newChildren);
    }
  }

  return {nodes: newNodes, orders: newOrders};
}
