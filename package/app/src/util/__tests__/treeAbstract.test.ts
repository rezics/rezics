/* eslint-disable no-console */

import {
    buildTree,
    createNode,
    deleteNodes,
    flattenTree,
    moveNode,
    updateNode,
    type FlatTree,
    type NodeBase,
    type OrderMap,
    type ID,
} from "../treeAbstract";

// --- A Simple Test Runner ---
const tests: { name: string; fn: () => void }[] = [];

/**
 * Defines a test case.
 * @param name The name of the test.
 * @param fn The function that runs the test.
 */
function test(name: string, fn: () => void) {
    tests.push({ name, fn });
}

/**
 * Runs all registered tests and reports a summary.
 */
function runTests() {
    let passed = 0;
    let failed = 0;
    const total = tests.length;

    console.log("--- Running Tree Abstract Tests ---");

    for (const { name, fn } of tests) {
        try {
            fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (e) {
            console.error(`❌ FAIL: ${name}`);
            if (e instanceof Error) {
                console.error(e.message);
                if ((e as any).actual !== undefined) {
                    console.error("Expected:");
                    console.dir((e as any).expected, { depth: null });
                    console.error("Actual:");
                    console.dir((e as any).actual, { depth: null });
                } else {
                    console.error(e.stack);
                }
            } else {
                console.error(e);
            }
            failed++;
        }
    }

    console.log("\n--- Test Summary ---");
    console.log(`Total: ${total}, Passed: ${passed}, Failed: ${failed}`);

    if (failed > 0) {
        console.error(`\n${failed} test(s) failed.`);
        // In a real environment, we'd exit with a non-zero code.
        // process.exit(1);
    } else {
        console.log("\nAll tests passed!");
    }
}

// --- Assertion Utilities ---

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a && b && typeof a === "object" && typeof b === "object") {
        if (a.constructor !== b.constructor) return false;

        let length, i;
        if (Array.isArray(a)) {
            length = a.length;
            if (length !== b.length) return false;
            for (i = length; i-- > 0; ) {
                if (!deepEqual(a[i], b[i])) return false;
            }
            return true;
        }

        if (a instanceof Map) {
            if (a.size !== b.size) return false;

            const aEntries: [any, any][] = Array.from(a.entries());
            const bEntries: [any, any][] = Array.from(b.entries());

            const sortFn = (entryA: [any, any], entryB: [any, any]) =>
                String(entryA[0]).localeCompare(String(entryB[0]));
            aEntries.sort(sortFn);
            bEntries.sort(sortFn);

            for (i = 0; i < aEntries.length; i++) {
                const [keyA, valueA] = aEntries[i]!;
                const [keyB, valueB] = bEntries[i]!;

                if (!deepEqual(keyA, keyB) || !deepEqual(valueA, valueB)) {
                    return false;
                }
            }

            return true;
        }

        const keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;

        for (i = length; i-- > 0; ) {
            const key: string = keys[i]!;
            if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key])) return false;
        }

        return true;
    }

    return a !== a && b !== b;
}

function assertDeepEqual(actual: any, expected: any, message?: string) {
    if (!deepEqual(actual, expected)) {
        const err = new Error(message || "Objects are not deeply equal.");
        (err as any).actual = actual;
        (err as any).expected = expected;
        throw err;
    }
}

// --- Test Data ---

interface NamedNode extends NodeBase {
    name: string;
}

const sampleNodes: NamedNode[] = [
    { id: "root1", name: "Root 1" },
    { id: "root2", name: "Root 2" },
    { id: "child1", name: "Child 1" },
    { id: "child2", name: "Child 2" },
    { id: "grandchild1", name: "Grandchild 1" },
];

const sampleOrders: OrderMap = new Map<ID | null, ID[]>([
    [null, ["root1", "root2"]],
    ["root1", ["child1", "child2"]],
    ["child1", ["grandchild1"]],
]);

const sampleTree: FlatTree<NamedNode> = {
    nodes: JSON.parse(JSON.stringify(sampleNodes)), // Deep copy for isolation
    orders: new Map(JSON.parse(JSON.stringify(Array.from(sampleOrders)))), // Deep copy
};

// --- Test Cases ---

test("buildTree: should construct a nested tree from a flat structure", () => {
    const forest = buildTree(sampleTree);
    const expected = [
        {
            id: "root1",
            name: "Root 1",
            children: [
                {
                    id: "child1",
                    name: "Child 1",
                    children: [{ id: "grandchild1", name: "Grandchild 1" }],
                },
                { id: "child2", name: "Child 2" },
            ],
        },
        { id: "root2", name: "Root 2" },
    ];
    assertDeepEqual(forest, expected);
});

test("buildTree: should return an empty array for an empty tree", () => {
    const emptyTree: FlatTree<NamedNode> = { nodes: [], orders: new Map() };
    const forest = buildTree(emptyTree);
    assertDeepEqual(forest, []);
});

test("flattenTree: should correctly flatten a nested tree", () => {
    const forest = buildTree(sampleTree);
    const flat = flattenTree(forest);

    // Node order might change, so we sort them by id for comparison.
    const sortedNodes = [...flat.nodes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const expectedSortedNodes = [...sampleTree.nodes].sort((a, b) => String(a.id).localeCompare(String(b.id)));

    assertDeepEqual(sortedNodes, expectedSortedNodes);

    // The flattenTree function may create empty arrays for leaf nodes
    const expectedOrders = new Map(sampleTree.orders);
    // expectedOrders.set('child2', []);
    // expectedOrders.set('grandchild1', []);
    // expectedOrders.set('root2', []);

    assertDeepEqual(flat.orders, expectedOrders);
});

test("createNode: should add a new root node", () => {
    const newNode: NamedNode = { id: "root3", name: "Root 3" };
    const newTree = createNode(sampleTree, newNode, null, 2);

    const expectedNodes = [...sampleTree.nodes, newNode];
    const expectedOrders = new Map(sampleTree.orders);
    expectedOrders.set(null, ["root1", "root2", "root3"]);

    assertDeepEqual(newTree.nodes, expectedNodes);
    assertDeepEqual(newTree.orders, expectedOrders);
});

test("createNode: should add a new child node", () => {
    const newNode: NamedNode = { id: "child3", name: "Child 3" };
    const newTree = createNode(sampleTree, newNode, "root1", 1);

    const expectedNodes = [...sampleTree.nodes, newNode];
    const expectedOrders = new Map(sampleTree.orders);
    expectedOrders.set("root1", ["child1", "child3", "child2"]);

    assertDeepEqual(newTree.nodes, expectedNodes);
    assertDeepEqual(newTree.orders, expectedOrders);
});

test("updateNode: should update a node's properties without changing its id", () => {
    const updates = { name: "Updated Root 1" };
    const newTree = updateNode(sampleTree, "root1", updates);

    const updatedNode = newTree.nodes.find((n) => n.id === "root1");
    assertDeepEqual(updatedNode, { id: "root1", name: "Updated Root 1" });

    // Ensure other nodes and orders are untouched.
    const originalOtherNodes = sampleTree.nodes.filter((n) => n.id !== "root1");
    const newOtherNodes = newTree.nodes.filter((n) => n.id !== "root1");
    assertDeepEqual(newOtherNodes, originalOtherNodes);
    assertDeepEqual(newTree.orders, sampleTree.orders);
});

test("moveNode: should move a node to a new parent", () => {
    // Move 'child2' to be a child of 'root2'
    const newTree = moveNode(sampleTree, "child2", "root2", 0);

    const expectedOrders = new Map([
        [null, ["root1", "root2"]],
        ["root1", ["child1"]],
        ["child1", ["grandchild1"]],
        ["root2", ["child2"]],
    ]);
    assertDeepEqual(newTree.orders, expectedOrders);
    assertDeepEqual(newTree.nodes, sampleTree.nodes); // Nodes themselves don't change
});

test("moveNode: should reorder a node within the same parent", () => {
    // Move 'child2' before 'child1' under 'root1'
    const newTree = moveNode(sampleTree, "child2", "root1", 0);

    const expectedOrders = new Map(sampleTree.orders);
    expectedOrders.set("root1", ["child2", "child1"]);

    assertDeepEqual(newTree.orders, expectedOrders);
});

test("deleteNodes: should delete a leaf node", () => {
    const newTree = deleteNodes(sampleTree, ["grandchild1"]);

    const expectedNodes = sampleTree.nodes.filter((n) => n.id !== "grandchild1");
    const expectedOrders = new Map(sampleTree.orders);
    expectedOrders.delete("child1"); // grandchild1 removed

    assertDeepEqual(newTree.nodes.map((n) => n.id).sort(), expectedNodes.map((n) => n.id).sort());
    assertDeepEqual(newTree.orders, expectedOrders);
});

test("deleteNodes: should delete a node and all its descendants (cascading)", () => {
    const newTree = deleteNodes(sampleTree, ["child1"]);

    const idsToDelete = ["child1", "grandchild1"];
    const expectedNodes = sampleTree.nodes.filter((n) => !idsToDelete.includes(n.id as string));

    const expectedOrders = new Map(sampleTree.orders);
    expectedOrders.set("root1", ["child2"]); // child1 removed
    expectedOrders.delete("child1"); // order for child1's children removed

    assertDeepEqual(newTree.nodes.map((n) => n.id).sort(), expectedNodes.map((n) => n.id).sort());
    assertDeepEqual(newTree.orders, expectedOrders);
});

test("deleteNodes: should delete a root node and its descendants", () => {
    const newTree = deleteNodes(sampleTree, ["root1"]);

    const idsToDelete = ["root1", "child1", "child2", "grandchild1"];
    const expectedNodes = sampleTree.nodes.filter((n) => !idsToDelete.includes(n.id as string));

    const expectedOrders = new Map(sampleTree.orders);
    expectedOrders.set(null, ["root2"]); // root1 removed
    expectedOrders.delete("root1"); // order for root1's children removed
    expectedOrders.delete("child1"); // order for child1's children removed

    assertDeepEqual(newTree.nodes.map((n) => n.id).sort(), expectedNodes.map((n) => n.id).sort());
    assertDeepEqual(newTree.orders, expectedOrders);
});

// --- Run all tests ---
runTests();
