import { pipe } from "@/util/fp";
import { A, O } from "@/util/fp";

export interface BaseNode {
    id: string | number;
}

interface TreeNode extends BaseNode {
    children?: TreeNode[];
}

/**
 * 树操作工具
 */

// 辅助函数：安全地将 id 转换为字符串进行比较
const normalizeId = (id: string | number): string => String(id);

// 辅助函数：检查两个 id 是否相等
const idsEqual = (id1: string | number, id2: string | number): boolean => normalizeId(id1) === normalizeId(id2);

// 辅助函数：在数组中查找节点索引
const findNodeIndex = (nodes: TreeNode[], targetId: string | number): O.Option<number> =>
    A.findFirstIndex(nodes, (node) => idsEqual(node.id, targetId));

// 辅助函数：安全地在指定位置插入元素
const insertAt =
    <T>(index: number, items: T[]) =>
    (array: T[]): T[] => {
        const [before, after] = A.splitAt(array, index);
        return [...before, ...items, ...after];
    };

// 辅助函数：深拷贝节点（避免引用共享）
const cloneNode = (node: TreeNode): TreeNode => {
    const { children, ...rest } = node;
    if (children) {
        return { ...rest, id: node.id, children: children.map(cloneNode) };
    }
    return { ...rest, id: node.id };
};

/**
 * 查找并移除指定 ID 的节点
 */
export const findAndRemove = (
    tree: ReadonlyArray<TreeNode>,
    ids: ReadonlyArray<string | number>,
    removed: TreeNode[],
): TreeNode[] => {
    const idsSet = new Set(ids.map(normalizeId));

    const processNode = (node: TreeNode): O.Option<TreeNode> => {
        if (idsSet.has(normalizeId(node.id))) {
            removed.push(cloneNode(node));
            return O.none();
        }

        if (node.children) {
            const newChildren = A.getSomes(node.children.map(processNode));
            return O.some({ ...node, children: newChildren });
        }

        return O.some(node);
    };

    return A.getSomes(Array.from(tree).map(processNode));
};

/**
 * 查找并在指定位置插入节点
 */
export const findAndInsert = (
    tree: ReadonlyArray<TreeNode>,
    parentId: string | number | null,
    index: number,
    nodesToInsert: ReadonlyArray<TreeNode>,
): TreeNode[] => {
    if (parentId === null) {
        return insertAt(index, Array.from(nodesToInsert))(Array.from(tree));
    }

    const processNode = (node: TreeNode): TreeNode => {
        if (idsEqual(node.id, parentId!)) {
            const currentChildren = node.children ?? [];
            const newChildren = insertAt(index, Array.from(nodesToInsert))(currentChildren);
            return { ...node, children: newChildren };
        }

        if (node.children) {
            return { ...node, children: node.children.map(processNode) };
        }

        return node;
    };

    return tree.map(processNode);
};

/**
 * 查找并编辑节点标题
 */
export const findAndEdit = (tree: ReadonlyArray<TreeNode>, id: string | number, newName: string): TreeNode[] => {
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
 * 查找并删除指定 ID 的节点
 */
export const findAndDelete = (tree: ReadonlyArray<TreeNode>, ids: ReadonlyArray<string | number>): TreeNode[] => {
    const idsSet = new Set(ids.map(normalizeId));

    const shouldKeep = (node: TreeNode): boolean => !idsSet.has(normalizeId(node.id));

    const processNode = (node: TreeNode): TreeNode => {
        if (node.children) {
            const filteredChildren = pipe(node.children, A.filter(shouldKeep), A.map(processNode));
            return { ...node, children: filteredChildren };
        }
        return node;
    };

    return pipe(tree, A.filter(shouldKeep), A.map(processNode));
};

/**
 * 查找并添加子节点
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
 * 在目标节点之后插入同级节点
 */
export const insertSiblingAfter = (
    tree: ReadonlyArray<TreeNode>,
    targetId: string | number,
    newNode: TreeNode,
): TreeNode[] => {
    let processed = false;

    const processNodes = (nodes: ReadonlyArray<TreeNode>): TreeNode[] => {
        if (processed) return Array.from(nodes);

        return pipe(
            findNodeIndex(Array.from(nodes), targetId),
            O.match({
                onNone: () =>
                    nodes.map((node) => (node.children ? { ...node, children: processNodes(node.children) } : node)),
                onSome: (index) => {
                    processed = true;
                    return insertAt(index + 1, [newNode])(Array.from(nodes));
                },
            }),
        );
    };

    return processNodes(tree);
};

/**
 * 将节点移动到同级最前
 */
export const moveSiblingFirst = (tree: ReadonlyArray<TreeNode>, targetId: string | number): TreeNode[] => {
    let processed = false;

    const processNodes = (nodes: ReadonlyArray<TreeNode>): TreeNode[] => {
        if (processed) return Array.from(nodes);

        return pipe(
            findNodeIndex(Array.from(nodes), targetId),
            O.match({
                onNone: () =>
                    nodes.map((node) => (node.children ? { ...node, children: processNodes(node.children) } : node)),
                onSome: (index) => {
                    processed = true;
                    const nodeArray = Array.from(nodes);
                    const targetNode = nodeArray[index]!;
                    const otherNodes = nodeArray.filter((_, i) => i !== index);
                    return [targetNode, ...otherNodes];
                },
            }),
        );
    };

    return processNodes(tree);
};

/**
 * 将节点移动到同级最后
 */
export const moveSiblingLast = (tree: ReadonlyArray<TreeNode>, targetId: string | number): TreeNode[] => {
    let processed = false;

    const processNodes = (nodes: ReadonlyArray<TreeNode>): TreeNode[] => {
        if (processed) return Array.from(nodes);

        return pipe(
            findNodeIndex(Array.from(nodes), targetId),
            O.match({
                onNone: () =>
                    nodes.map((node) => (node.children ? { ...node, children: processNodes(node.children) } : node)),
                onSome: (index) => {
                    processed = true;
                    const nodeArray = Array.from(nodes);
                    const targetNode = nodeArray[index]!;
                    const otherNodes = nodeArray.filter((_, i) => i !== index);
                    return [...otherNodes, targetNode];
                },
            }),
        );
    };

    return processNodes(tree);
};
