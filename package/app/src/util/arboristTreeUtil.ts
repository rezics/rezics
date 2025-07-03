export interface BaseNode {
    id: string | number;
}

interface TreeNode extends BaseNode {
    children?: TreeNode[];
}

export function findAndRemove(tree: TreeNode[], ids: (string | number)[], removed: TreeNode[]): any[] {
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

export function findAndInsert(
    tree: TreeNode[],
    parentId: string | number | null,
    index: number,
    nodesToInsert: TreeNode[],
): any[] {
    if (parentId === null) {
        return [...tree.slice(0, index), ...nodesToInsert, ...tree.slice(index)];
    }
    return tree.map((node) => {
        if (node.id === parentId) {
            if (!node.children) node.children = [];
            const newChildren = [...node.children.slice(0, index), ...nodesToInsert, ...node.children.slice(index)];
            return { ...node, children: newChildren };
        }
        if (node.children) {
            return { ...node, children: findAndInsert(node.children, parentId, index, nodesToInsert) };
        }
        return node;
    });
}

export function findAndEdit(tree: TreeNode[], id: string | number, newName: string): any[] {
    return tree.map((node) => {
        if (node.id === id) {
            return { ...node, title: newName };
        }
        if (node.children) {
            return { ...node, children: findAndEdit(node.children, id, newName) };
        }
        return node;
    });
}

export function findAndDelete(tree: TreeNode[], ids: (string | number)[]): any[] {
    return tree.filter((node) => {
        if (ids.includes(node.id)) {
            return false;
        }
        if (node.children) {
            node.children = findAndDelete(node.children, ids);
        }
        return true;
    });
}

export function findAndAddChild(tree: TreeNode[], parentId: string | number, newNode: TreeNode): any[] {
    return tree.map((node) => {
        if (node.id === parentId) {
            const children = node.children ? [...node.children, newNode] : [newNode];
            return { ...node, children };
        }
        if (node.children) {
            return { ...node, children: findAndAddChild(node.children, parentId, newNode) };
        }
        return node;
    });
}

// 插入同级节点（在目标节点之后）
export function insertSiblingAfter(tree: TreeNode[], targetId: string | number, newNode: TreeNode): any[] {
    let done = false;
    const recurse = (nodes: TreeNode[]): TreeNode[] => {
        if (done) return nodes;
        const idx = nodes.findIndex((n) => String(n.id) === String(targetId));
        if (idx !== -1) {
            done = true;
            return [...nodes.slice(0, idx + 1), newNode, ...nodes.slice(idx + 1)];
        }
        return nodes.map((n) => (n.children ? { ...n, children: recurse(n.children) } : n));
    };
    return recurse(tree);
}

// 移到同级最前
export function moveSiblingFirst(tree: TreeNode[], targetId: string | number): any[] {
    let done = false;
    const recurse = (nodes: TreeNode[]): TreeNode[] => {
        if (done) return nodes;
        const idx = nodes.findIndex((n) => String(n.id) === String(targetId));
        if (idx !== -1) {
            done = true;
            const node = nodes[idx]!;
            const rest = [...nodes.slice(0, idx), ...nodes.slice(idx + 1)];
            return [node, ...rest];
        }
        return nodes.map((n) => (n.children ? { ...n, children: recurse(n.children) } : n));
    };
    return recurse(tree);
}

// 移到同级最后
export function moveSiblingLast(tree: TreeNode[], targetId: string | number): any[] {
    let done = false;
    const recurse = (nodes: TreeNode[]): TreeNode[] => {
        if (done) return nodes;
        const idx = nodes.findIndex((n) => String(n.id) === String(targetId));
        if (idx !== -1) {
            done = true;
            const node = nodes[idx]!;
            const rest = [...nodes.slice(0, idx), ...nodes.slice(idx + 1)];
            return [...rest, node];
        }
        return nodes.map((n) => (n.children ? { ...n, children: recurse(n.children) } : n));
    };
    return recurse(tree);
}