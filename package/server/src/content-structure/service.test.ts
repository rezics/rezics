import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

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
  rating: string | null;
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

const findManyContentStructureNode = mock(async (args: any): Promise<any[]> => {
  const where = args?.where ?? {};
  return store
    .filter(
      (row) => !where.ownerUnitId || row.ownerUnitId === where.ownerUnitId,
    )
    .filter((row) =>
      where.isDeleted === undefined ? true : row.isDeleted === where.isDeleted,
    )
    .filter((row) => {
      if (!where.id) return true;
      if (where.id.in) {
        if (!where.id.in.includes(row.id)) return false;
      }
      if (where.id.notIn && where.id.notIn.includes(row.id)) return false;
      return true;
    })
    .filter((row) => {
      if (!where.parentId) return true;
      if (where.parentId.in) {
        return (
          row.parentId !== null && where.parentId.in.includes(row.parentId)
        );
      }
      return true;
    });
});

const updateManyContentStructureNode = mock(async (args: any) => {
  const where = args.where;
  let count = 0;
  for (const row of store) {
    if (where.ownerUnitId && row.ownerUnitId !== where.ownerUnitId) continue;
    if (where.isDeleted !== undefined && row.isDeleted !== where.isDeleted)
      continue;
    if (where.id?.in && !where.id.in.includes(row.id)) continue;
    if (where.id?.notIn && where.id.notIn.includes(row.id)) continue;
    if (where.parentId?.in) {
      if (!row.parentId || !where.parentId.in.includes(row.parentId)) continue;
    }
    Object.assign(row, args.data);
    count++;
  }
  return { count };
});

const updateContentStructureNode = mock(async (args: any) => {
  const row = store.find((r) => r.id === args.where.id);
  if (row) Object.assign(row, args.data);
  return row;
});

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

const mockTx = {
  $queryRaw: allocateSequence,
  contentStructureNode: {
    findMany: findManyContentStructureNode,
    update: updateContentStructureNode,
    updateMany: updateManyContentStructureNode,
    create: mock(async () => ({})),
  },
  contentStructure: {
    update: updateContainerMock,
    upsert: upsertContainerMock,
  },
  contentStructureAnchor: {
    deleteMany: deleteManyAnchorsMock,
    createMany: createManyAnchorsMock,
  },
  historyOutbox: {
    create: createHistoryOutbox,
  },
};

const transactionMock = mock(async (fn: (tx: unknown) => unknown) =>
  fn(mockTx),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  contentStructure: { findUniqueOrThrow: findContainerMock },
  contentStructureNode: { findMany: findManyContentStructureNode },
});

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
  transactionMock.mockClear();
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

    const { contentStructureService } = await import("./service");
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

    const { contentStructureService } = await import("./service");
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

    const { contentStructureService } = await import("./service");
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

    const { contentStructureService } = await import("./service");
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

    const { contentStructureService } = await import("./service");
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

    const { contentStructureService } = await import("./service");
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

    const { contentStructureService } = await import("./service");
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

    const { contentStructureService } = await import("./service");
    await contentStructureService.update("book-1", [{ id: "a", title: "A" }]);

    // No soft delete should have fired because "buried" was not in baseline diff
    const updateManyCalls = updateManyContentStructureNode.mock.calls;
    expect(updateManyCalls.length).toBe(0);
  });
});
