import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ContentRating } from "@rezics/contract";
import type {
  ContentStructureAnchorWrite,
  ContentStructureRepository,
  ContentStructureTx,
} from "./service";

mock.module("@/infra/infra-users", () => ({
  resolveRezicsWikiUserId: async () => "rezics-wiki-user",
}));

interface FakeNode {
  id: string;
  ownerUnitId: string;
  parentId: string | null;
  position: string;
  contentUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeNode(partial: Partial<FakeNode> & Pick<FakeNode, "id">): FakeNode {
  return {
    ownerUnitId: "book-1",
    parentId: null,
    position: "g",
    contentUnitId: null,
    title: partial.id,
    noContent: false,
    rating: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  };
}

let store: FakeNode[] = [];

function findNodesInStore(
  ownerUnitId: string,
  options: {
    isDeleted?: boolean;
    ids?: readonly string[];
    excludeIds?: readonly string[];
    parentIds?: readonly string[];
  } = {},
): FakeNode[] {
  return store
    .filter((row) => row.ownerUnitId === ownerUnitId)
    .filter((row) =>
      options.isDeleted === undefined
        ? true
        : row.isDeleted === options.isDeleted,
    )
    .filter((row) => {
      if (options.ids && !options.ids.includes(row.id)) return false;
      if (options.excludeIds?.includes(row.id)) return false;
      return true;
    })
    .filter((row) => {
      if (!options.parentIds) return true;
      if (row.parentId === null) {
        return options.parentIds.includes(null as never);
      }
      return options.parentIds.includes(row.parentId);
    })
    .sort((a, b) =>
      a.parentId === b.parentId
        ? a.position.localeCompare(b.position)
        : String(a.parentId).localeCompare(String(b.parentId)),
    );
}

const findManyContentStructureNode = mock(
  async (
    ownerUnitId: string,
    options?: Parameters<ContentStructureTx["findNodes"]>[1],
  ): Promise<FakeNode[]> => findNodesInStore(ownerUnitId, options),
);

const updateManyContentStructureNode = mock(
  async (
    ownerUnitId: string,
    options: Parameters<ContentStructureTx["updateManyNodes"]>[1],
    data: Partial<FakeNode>,
  ) => {
    let count = 0;
    for (const row of findNodesInStore(ownerUnitId, options)) {
      Object.assign(row, data);
      count++;
    }
    return { count };
  },
);

const updateContentStructureNode = mock(
  async (nodeId: string, data: Partial<FakeNode>) => {
    const row = store.find((r) => r.id === nodeId);
    if (row) Object.assign(row, data);
    return row;
  },
);

const updateContainerMock = mock(async (_args: unknown) => ({}));
const createHistoryOutbox = mock(async (_args: unknown) => ({}));
const allocateSequence = mock(async (_strings: TemplateStringsArray) => [
  { sequence: 1n },
]);
const deleteManyAnchorsMock = mock(async (_args: unknown) => ({ count: 0 }));
const createManyAnchorsMock = mock(async (_args: unknown) => ({ count: 0 }));

const upsertContainerMock = mock(async (_args: unknown) => ({}));
const findContainerMock = mock(async (_args: unknown) => ({
  ownerUnitId: "book-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}));

const mockTx: ContentStructureTx = {
  mutationTx: { source: "content-structure-test" },
  async $queryRaw<T = unknown>(
    strings: TemplateStringsArray,
    ..._values: unknown[]
  ): Promise<T> {
    return (await allocateSequence(strings)) as T;
  },
  historyOutbox: {
    create: createHistoryOutbox,
  },
  async ensureForOwner(ownerUnitId) {
    await upsertContainerMock(ownerUnitId);
  },
  getContainer: findContainerMock,
  findNodes: findManyContentStructureNode,
  createNode: mock(async (ownerUnitId, row) => {
    store.push(
      makeNode({
        id: row.id,
        ownerUnitId,
        parentId: row.parentId,
        position: row.position,
        contentUnitId: row.contentUnitId,
        title: row.title,
        noContent: row.noContent,
        rating: row.rating,
      }),
    );
  }),
  async updateNode(nodeId, data) {
    await updateContentStructureNode(nodeId, data);
  },
  async updateManyNodes(ownerUnitId, options, data) {
    await updateManyContentStructureNode(ownerUnitId, options, data);
  },
  async updateContainer(ownerUnitId) {
    await updateContainerMock(ownerUnitId);
  },
  async deleteAnchors(ownerUnitId) {
    await deleteManyAnchorsMock(ownerUnitId);
  },
  async createAnchors(rows: readonly ContentStructureAnchorWrite[]) {
    await createManyAnchorsMock(rows);
  },
};

const repository: ContentStructureRepository = {
  async getByOwnerUnitId(ownerUnitId) {
    return {
      container: await findContainerMock({ ownerUnitId }),
      nodes: await findManyContentStructureNode(ownerUnitId, {
        isDeleted: false,
      }),
    };
  },
  async transaction(fn) {
    return fn(mockTx);
  },
};

async function createService() {
  const { ContentStructureService } = await import("./service");
  return new ContentStructureService(repository);
}

function resetMocks(): void {
  store = [];
  findManyContentStructureNode.mockClear();
  updateContentStructureNode.mockClear();
  updateManyContentStructureNode.mockClear();
  updateContainerMock.mockClear();
  upsertContainerMock.mockClear();
  findContainerMock.mockClear();
  createHistoryOutbox.mockClear();
  allocateSequence.mockClear();
  deleteManyAnchorsMock.mockClear();
  createManyAnchorsMock.mockClear();
}

describe("buildContentStructureAnchorRows", () => {
  test("projects materialized nodes with ancestor ids, path, depth, and position path", async () => {
    const { buildContentStructureAnchorRows } = await import("./service");
    const anchors = buildContentStructureAnchorRows("book-1", [
      makeNode({ id: "root", title: "Root", position: "m" }),
      makeNode({
        id: "chapter-a",
        parentId: "root",
        position: "a",
        title: "A",
        contentUnitId: "content-a",
      }),
      makeNode({
        id: "section-b",
        parentId: "chapter-a",
        position: "b",
        title: "B",
        contentUnitId: "content-b",
      }),
      makeNode({
        id: "empty",
        parentId: "root",
        position: "z",
        title: "Empty",
        contentUnitId: null,
      }),
    ]);

    expect(anchors).toEqual([
      {
        nodeId: "chapter-a",
        ownerUnitId: "book-1",
        contentUnitId: "content-a",
        parentNodeId: "root",
        ancestorNodeIds: ["root"],
        path: ["root", "chapter-a"],
        depth: 1,
        position: "a",
        positionPath: "m.a",
        titlePath: ["Root", "A"],
      },
      {
        nodeId: "section-b",
        ownerUnitId: "book-1",
        contentUnitId: "content-b",
        parentNodeId: "chapter-a",
        ancestorNodeIds: ["root", "chapter-a"],
        path: ["root", "chapter-a", "section-b"],
        depth: 2,
        position: "b",
        positionPath: "m.a.b",
        titlePath: ["Root", "A", "B"],
      },
    ]);
  });
});

describe("ContentStructureService.softDeleteNodes", () => {
  beforeEach(resetMocks);

  test("promotes non-target children to root and tombstones targets", async () => {
    store.push(
      makeNode({ id: "p", parentId: null, position: "g", title: "P" }),
      makeNode({ id: "c1", parentId: "p", position: "g", title: "C1" }),
      makeNode({ id: "c2", parentId: "p", position: "n", title: "C2" }),
    );

    const contentStructureService = await createService();
    await contentStructureService.softDeleteNodes("book-1", ["p"]);

    expect(store.find((r) => r.id === "p")?.isDeleted).toBe(true);
    expect(store.find((r) => r.id === "p")?.deletedAt).toBeInstanceOf(Date);
    expect(store.find((r) => r.id === "c1")?.parentId).toBeNull();
    expect(store.find((r) => r.id === "c2")?.parentId).toBeNull();
    expect(store.find((r) => r.id === "c1")?.isDeleted).toBe(false);

    const op = (createHistoryOutbox.mock.calls[0]?.[0] as any).data.payload
      .event.payload.operations[0];
    expect(op.op).toBe("node.delete");
    expect(op.softDelete).toBe(true);
    expect(new Set(op.promotedChildIds)).toEqual(new Set(["c1", "c2"]));
  });

  test("batch with parent + child: child stays buried", async () => {
    store.push(
      makeNode({ id: "p", parentId: null, position: "g", title: "P" }),
      makeNode({ id: "c1", parentId: "p", position: "g", title: "C1" }),
      makeNode({ id: "c2", parentId: "p", position: "n", title: "C2" }),
    );

    const contentStructureService = await createService();
    await contentStructureService.softDeleteNodes("book-1", ["p", "c1"]);

    expect(store.find((r) => r.id === "p")?.isDeleted).toBe(true);
    expect(store.find((r) => r.id === "c1")?.isDeleted).toBe(true);
    expect(store.find((r) => r.id === "c1")?.parentId).toBe("p");
    expect(store.find((r) => r.id === "c2")?.parentId).toBeNull();
    expect(store.find((r) => r.id === "c2")?.isDeleted).toBe(false);
  });

  test("idempotent: already-deleted targets are skipped without history", async () => {
    store.push(
      makeNode({
        id: "p",
        parentId: null,
        position: "g",
        title: "P",
        isDeleted: true,
        deletedAt: new Date(),
      }),
    );

    const contentStructureService = await createService();
    await contentStructureService.softDeleteNodes("book-1", ["p"]);

    expect(createHistoryOutbox).not.toHaveBeenCalled();
    expect(updateContainerMock).not.toHaveBeenCalled();
  });
});

describe("ContentStructureService.restoreNodes", () => {
  beforeEach(resetMocks);

  test("restore with alive parent returns the node to its original parent", async () => {
    store.push(
      makeNode({ id: "p", parentId: null, position: "g", title: "P" }),
      makeNode({
        id: "c",
        parentId: "p",
        position: "n",
        title: "C",
        isDeleted: true,
        deletedAt: new Date(),
      }),
    );

    const contentStructureService = await createService();
    await contentStructureService.restoreNodes("book-1", ["c"]);

    const c = store.find((r) => r.id === "c");
    expect(c?.isDeleted).toBe(false);
    expect(c?.parentId).toBe("p");

    const op = (createHistoryOutbox.mock.calls[0]?.[0] as any).data.payload
      .event.payload.operations[0];
    expect(op.op).toBe("node.restore");
    expect(op.placement.parentId).toBe("p");
    expect(op.fallbackToRoot).toBe(false);
  });

  test("restore with dead parent falls back to root", async () => {
    store.push(
      makeNode({
        id: "p",
        parentId: null,
        position: "g",
        title: "P",
        isDeleted: true,
        deletedAt: new Date(),
      }),
      makeNode({
        id: "c",
        parentId: "p",
        position: "n",
        title: "C",
        isDeleted: true,
        deletedAt: new Date(),
      }),
    );

    const contentStructureService = await createService();
    await contentStructureService.restoreNodes("book-1", ["c"]);

    const c = store.find((r) => r.id === "c");
    expect(c?.parentId).toBeNull();
    expect(c?.isDeleted).toBe(false);

    const op = (createHistoryOutbox.mock.calls[0]?.[0] as any).data.payload
      .event.payload.operations[0];
    expect(op.fallbackToRoot).toBe(true);
  });

  test("skips non-deleted targets", async () => {
    store.push(
      makeNode({ id: "x", parentId: null, position: "g", title: "X" }),
    );

    const contentStructureService = await createService();
    await contentStructureService.restoreNodes("book-1", ["x"]);

    expect(createHistoryOutbox).not.toHaveBeenCalled();
  });
});

describe("ContentStructureService.update — soft-delete-aware", () => {
  beforeEach(resetMocks);

  test("rejects submitted id that points to a tombstoned row", async () => {
    store.push(
      makeNode({
        id: "ghost",
        parentId: null,
        position: "g",
        title: "Ghost",
        isDeleted: true,
        deletedAt: new Date(),
      }),
    );

    const contentStructureService = await createService();
    await expect(
      contentStructureService.update("book-1", [
        { id: "ghost", title: "Ghost rises" },
      ]),
    ).rejects.toThrow(/deleted/i);
  });

  test("ignores deleted rows when diffing the baseline", async () => {
    store.push(
      makeNode({ id: "a", parentId: null, position: "g", title: "A" }),
      makeNode({
        id: "buried",
        parentId: null,
        position: "n",
        title: "Buried",
        isDeleted: true,
        deletedAt: new Date(),
      }),
    );

    const contentStructureService = await createService();
    await contentStructureService.update("book-1", [{ id: "a", title: "A" }]);

    // No soft delete should have fired because "buried" was not in baseline diff
    const updateManyCalls = updateManyContentStructureNode.mock.calls;
    expect(updateManyCalls.length).toBe(0);
  });
});
