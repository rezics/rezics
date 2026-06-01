import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
  UserUnitProgressStatus,
} from "@/test/prisma-client-mock";

const baseRow: any = {
  userId: "user-1",
  unitId: "unit-1",
  progress: 0,
  status: UserUnitProgressStatus.BACKLOG,
  isDeleted: false,
  completedCount: 0,
  totalTimeMs: 0n,
  lastReadNodeId: null,
  lastReadAnchor: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  extra: null,
};

const mockUpsert = mock(async () => baseRow);
const mockFindUnique = mock(async (): Promise<any> => baseRow);
const mockFindMany = mock(async (): Promise<any[]> => []);
const mockUpdateMany = mock(async () => ({ count: 0 }));
const mockNodeFindUnique = mock(async (_args: unknown): Promise<any> => null);
const mockNodeProgressUpsert = mock(async (_args: unknown) => ({}));
const mockNodeProgressDeleteMany = mock(async (_args: unknown) => ({
  count: 0,
}));
const mockShelfUnitFindMany = mock(async () => [] as any[]);
const enqueueMock = mock(async (_command: any) => ({
  status: "created" as const,
}));
const mockProgressSearch = mock(async () => ({
  estimatedTotalHits: 0,
  hits: [],
  facetDistribution: {},
}));

function firstArg(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls[0]?.[0] as any;
}

mock.module("@rezics/search", () => ({
  PROGRESS_BUCKET_COUNT: 10,
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

installPrismaClientMock();
Object.assign(prismaMock, {
  userUnitProgress: {
    upsert: mockUpsert,
    findUnique: mockFindUnique,
    findMany: mockFindMany,
    updateMany: mockUpdateMany,
  },
  contentStructureNode: {
    findUnique: mockNodeFindUnique,
  },
  userContentNodeProgress: {
    upsert: mockNodeProgressUpsert,
    deleteMany: mockNodeProgressDeleteMany,
  },
  shelfUnit: {
    findMany: mockShelfUnitFindMany,
  },
});

mock.module("@/meili/search-client", () => ({
  searchClient: {
    progressIndex: {
      search: mockProgressSearch,
    },
  },
}));

describe("ProgressService", () => {
  beforeEach(() => {
    mockUpsert.mockClear();
    mockFindUnique.mockClear();
    mockFindMany.mockClear();
    mockUpdateMany.mockClear();
    mockNodeFindUnique.mockClear();
    mockNodeProgressUpsert.mockClear();
    mockNodeProgressDeleteMany.mockClear();
    mockShelfUnitFindMany.mockClear();
    enqueueMock.mockClear();
    mockProgressSearch.mockClear();
    mockUpsert.mockResolvedValue(baseRow);
    mockFindUnique.mockResolvedValue(baseRow);
    mockFindMany.mockResolvedValue([]);
    mockNodeFindUnique.mockResolvedValue(null);
    mockShelfUnitFindMany.mockResolvedValue([]);
    mockProgressSearch.mockResolvedValue({
      estimatedTotalHits: 0,
      hits: [],
      facetDistribution: {},
    });
  });

  test("first-time upsert creates defaults and additive time", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", { addTimeMs: 2500 });

    const args = firstArg(mockUpsert);
    expect(args.where).toEqual({
      userId_unitId: { userId: "user-1", unitId: "unit-1" },
    });
    expect(args.create.progress).toBe(0);
    expect(args.create.status).toBe("BACKLOG");
    expect(args.create.isDeleted).toBe(false);
    expect(args.create.completedCount).toBe(0);
    expect(args.create.totalTimeMs).toBe(2500n);
    expect(args.create.lastReadNode).toBeUndefined();
    expect(args.create.lastReadAnchor).toBeUndefined();
    expect(args.update.totalTimeMs).toEqual({ increment: 2500n });
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.progress.sync",
        payload: { userId: "user-1", unitId: "unit-1" },
        source: { type: "server", service: "progress" },
      }),
    );
  });

  test("partial upsert preserves untouched fields in update branch", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      progress: 0.42,
      addTimeMs: 100,
    });

    const update = firstArg(mockUpsert).update;
    expect(update.progress).toBe(0.42);
    expect(update.isDeleted).toBe(false);
    expect(update.totalTimeMs).toEqual({ increment: 100n });
    expect(update.status).toBeUndefined();
    expect(update.completedCount).toBeUndefined();
    expect(update.lastReadNode).toBeUndefined();
    expect(update.lastReadAnchor).toBeUndefined();
    expect(update.extra).toBeUndefined();
  });

  test("persists lastReadNodeId via Prisma relation connect", async () => {
    mockNodeFindUnique.mockResolvedValue({
      isDeleted: false,
      ownerUnitId: "book-1",
    });
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "book-1", {
      lastReadNodeId: "node-1",
      lastReadAnchor: { text: "Opening" },
    });

    const args = firstArg(mockUpsert);
    expect(args.create.lastReadNode).toEqual({ connect: { id: "node-1" } });
    expect(args.create.lastReadAnchor).toEqual({ text: "Opening" });
    expect(args.update.lastReadNode).toEqual({ connect: { id: "node-1" } });
    expect(args.update.lastReadAnchor).toEqual({ text: "Opening" });
  });

  test("rejects upserts whose lastReadNodeId points to a deleted node", async () => {
    mockNodeFindUnique.mockResolvedValue({
      isDeleted: true,
      ownerUnitId: "book-1",
    });
    const { progressService } = await import("./progress.service");
    await expect(
      progressService.upsert("user-1", "book-1", {
        lastReadNodeId: "node-deleted",
      }),
    ).rejects.toThrow(/deleted/i);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("rejects invalid progress and negative addTimeMs", async () => {
    const { progressService } = await import("./progress.service");

    await expect(
      progressService.upsert("user-1", "unit-1", { progress: 1.1 }),
    ).rejects.toThrow(/progress/);
    await expect(
      progressService.upsert("user-1", "unit-1", { addTimeMs: -1 }),
    ).rejects.toThrow(/addTimeMs/);
    await expect(
      progressService.upsert("user-1", "unit-1", { completedCount: -1 }),
    ).rejects.toThrow(/completedCount/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("accepts narrow paused extra", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      status: "PAUSED",
      extra: { paused: { reasonPostUnitIds: ["post-1"] } },
    });

    const args = firstArg(mockUpsert);
    expect(args.create.extra).toEqual({
      paused: { reasonPostUnitIds: ["post-1"] },
    });
    expect(args.update.extra).toEqual({
      paused: { reasonPostUnitIds: ["post-1"] },
    });
  });

  test("rejects extra with unknown top-level key", async () => {
    const { progressService } = await import("./progress.service");

    await expect(
      progressService.upsert("user-1", "unit-1", {
        extra: { foo: { bar: 1 } } as never,
      }),
    ).rejects.toThrow(/extra/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("coerces completed status when progress reaches 1 without explicit status", async () => {
    mockFindUnique.mockResolvedValue({
      status: UserUnitProgressStatus.ACTIVE,
      completedCount: 2,
    });
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", { progress: 1 });

    const args = firstArg(mockUpsert);
    expect(args.create.status).toBe("COMPLETED");
    expect(args.create.completedCount).toBe(3);
    expect(args.update.status).toBe("COMPLETED");
    expect(args.update.completedCount).toBe(3);
  });

  test("does not increment completed count when already completed", async () => {
    mockFindUnique.mockResolvedValue({
      status: UserUnitProgressStatus.COMPLETED,
      completedCount: 2,
    });
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      status: "COMPLETED",
    });

    const args = firstArg(mockUpsert);
    expect(args.update.status).toBe("COMPLETED");
    expect(args.update.completedCount).toBeUndefined();
  });

  test("creates completed row with count 1 on first completion", async () => {
    mockFindUnique.mockResolvedValue(null);
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      status: "COMPLETED",
    });

    const args = firstArg(mockUpsert);
    expect(args.create.status).toBe("COMPLETED");
    expect(args.create.completedCount).toBe(1);
    expect(args.update.completedCount).toBe(1);
  });

  test("allows explicit completed count override", async () => {
    mockFindUnique.mockResolvedValue({
      status: UserUnitProgressStatus.ACTIVE,
      completedCount: 2,
    });
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      status: "COMPLETED",
      completedCount: 7,
    });

    const args = firstArg(mockUpsert);
    expect(args.create.completedCount).toBe(7);
    expect(args.update.completedCount).toBe(7);
  });

  test("supports paused status", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      status: "PAUSED",
    });

    const args = firstArg(mockUpsert);
    expect(args.create.status).toBe("PAUSED");
    expect(args.update.status).toBe("PAUSED");
  });

  test("explicit status wins over progress coercion", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      progress: 1,
      status: "DROPPED",
    });

    const args = firstArg(mockUpsert);
    expect(args.create.status).toBe("DROPPED");
    expect(args.update.status).toBe("DROPPED");
  });

  test("delete soft-deletes progress and removes it from search", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.delete("user-1", "unit-1");

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1" },
      data: {
        isDeleted: true,
        lastSeenAt: expect.any(Date),
      },
    });
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.progress.remove",
        payload: { userId: "user-1", unitId: "unit-1" },
        source: { type: "server", service: "progress" },
      }),
    );
  });

  test("list clamps limit and returns next cursor", async () => {
    const rows = [
      { ...baseRow, unitId: "unit-3", lastSeenAt: new Date("2026-01-03") },
      { ...baseRow, unitId: "unit-2", lastSeenAt: new Date("2026-01-02") },
    ];
    mockFindMany.mockResolvedValue(rows);
    const { progressService } = await import("./progress.service");

    const result = await progressService.list("user-1", { limit: 1 });

    const args = firstArg(mockFindMany);
    expect(args.where).toEqual({ userId: "user-1", isDeleted: false });
    expect(args.orderBy).toEqual([{ lastSeenAt: "desc" }, { unitId: "desc" }]);
    expect(args.take).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.nextCursor).toBeTruthy();
  });

  test("listLibrary hydrates progress-owned unit cards without shelf membership", async () => {
    mockFindMany.mockResolvedValue([
      {
        ...baseRow,
        unitId: "variant-1",
        progress: 0.4,
        unit: {
          type: "BOOK",
          catalogEntryKind: "VARIANT",
          targetUnitId: "book-main-1",
          defaultLanguage: "en",
          translations: [
            {
              language: "en",
              title: "Dune First Edition",
              extra: { coverUrl: "https://cdn.example/dune.jpg" },
            },
          ],
          targetUnit: {
            type: "BOOK",
            catalogEntryKind: "MAIN",
            targetUnitId: null,
            defaultLanguage: "en",
            translations: [
              {
                language: "en",
                title: "Dune",
                extra: { coverUrl: "https://cdn.example/dune-main.jpg" },
              },
            ],
          },
        },
        lastReadNode: null,
      },
    ]);
    const { progressService } = await import("./progress.service");

    const result = await progressService.listLibrary("user-1", { limit: 10 });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          unit: expect.any(Object),
          lastReadNode: expect.any(Object),
        }),
      }),
    );
    expect(mockShelfUnitFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { unitId: { in: ["variant-1"] } },
            { variantUnitId: { in: ["variant-1"] } },
          ],
          shelf: { unit: { userId: "user-1" } },
        },
      }),
    );
    expect(result.rows[0]).toMatchObject({
      progressUnit: {
        unitId: "variant-1",
        title: "Dune First Edition",
        coverUrl: "https://cdn.example/dune.jpg",
        unitType: "BOOK",
        catalogEntryKind: "VARIANT",
        targetUnitId: "book-main-1",
      },
      mainUnitContext: {
        unitId: "book-main-1",
        title: "Dune",
        coverUrl: "https://cdn.example/dune-main.jpg",
        unitType: "BOOK",
        catalogEntryKind: "MAIN",
        targetUnitId: null,
      },
      resumeRoute: { kind: "book", bookId: "variant-1" },
      shelves: [],
    });
  });

  test("listLibrary surfaces shelves that directly contain the progress unit or store it as variant context", async () => {
    mockFindMany.mockResolvedValue([
      {
        ...baseRow,
        unitId: "variant-1",
        unit: {
          type: "BOOK",
          catalogEntryKind: "VARIANT",
          targetUnitId: "book-main-1",
          defaultLanguage: "en",
          translations: [{ language: "en", title: "Dune First Edition" }],
          targetUnit: null,
        },
        lastReadNode: null,
      },
    ]);
    mockShelfUnitFindMany.mockResolvedValue([
      {
        unitId: "variant-1",
        variantUnitId: null,
        shelfId: "direct-shelf",
        shelf: {
          unit: {
            defaultLanguage: "en",
            translations: [{ language: "en", title: "Direct Shelf" }],
          },
        },
      },
      {
        unitId: "book-main-1",
        variantUnitId: "variant-1",
        shelfId: "context-shelf",
        shelf: {
          unit: {
            defaultLanguage: "en",
            translations: [{ language: "en", title: "Context Shelf" }],
          },
        },
      },
    ]);
    const { progressService } = await import("./progress.service");

    const result = await progressService.listLibrary("user-1", { limit: 10 });

    expect(result.rows[0]?.shelves).toEqual([
      { shelfUnitId: "direct-shelf", title: "Direct Shelf" },
      { shelfUnitId: "context-shelf", title: "Context Shelf" },
    ]);
  });

  test("listLibrary preserves variant book id and last-read node in resume routes", async () => {
    mockFindMany.mockResolvedValue([
      {
        ...baseRow,
        unitId: "variant-1",
        lastReadNodeId: "node-1",
        unit: {
          type: "BOOK",
          catalogEntryKind: "VARIANT",
          targetUnitId: "book-main-1",
          defaultLanguage: "en",
          translations: [{ language: "en", title: "Dune First Edition" }],
          targetUnit: {
            type: "BOOK",
            catalogEntryKind: "MAIN",
            targetUnitId: null,
            defaultLanguage: "en",
            translations: [{ language: "en", title: "Dune" }],
          },
        },
        lastReadNode: { isDeleted: false },
      },
    ]);
    const { progressService } = await import("./progress.service");

    const result = await progressService.listLibrary("user-1", { limit: 10 });

    expect(result.rows[0]?.resumeRoute).toEqual({
      kind: "node",
      bookId: "variant-1",
      nodeId: "node-1",
    });
  });

  test("toggleNodeCompletion (on) upserts a progress row", async () => {
    mockNodeFindUnique.mockResolvedValue({
      ownerUnitId: "book-1",
      isDeleted: false,
    });
    const { progressService } = await import("./progress.service");

    await progressService.toggleNodeCompletion(
      "user-1",
      "book-1",
      "node-1",
      true,
    );

    expect(mockNodeProgressUpsert).toHaveBeenCalledWith({
      where: { userId_nodeId: { userId: "user-1", nodeId: "node-1" } },
      create: { userId: "user-1", nodeId: "node-1" },
      update: {},
    });
    expect(mockNodeProgressDeleteMany).not.toHaveBeenCalled();
  });

  test("toggleNodeCompletion (off) deletes the progress row", async () => {
    mockNodeFindUnique.mockResolvedValue({
      ownerUnitId: "book-1",
      isDeleted: false,
    });
    const { progressService } = await import("./progress.service");

    await progressService.toggleNodeCompletion(
      "user-1",
      "book-1",
      "node-1",
      false,
    );

    expect(mockNodeProgressDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", nodeId: "node-1" },
    });
    expect(mockNodeProgressUpsert).not.toHaveBeenCalled();
  });

  test("toggleNodeCompletion rejects deleted nodes (409)", async () => {
    mockNodeFindUnique.mockResolvedValue({
      ownerUnitId: "book-1",
      isDeleted: true,
    });
    const { progressService } = await import("./progress.service");
    await expect(
      progressService.toggleNodeCompletion("user-1", "book-1", "node-1", true),
    ).rejects.toThrow(/deleted/i);
    expect(mockNodeProgressUpsert).not.toHaveBeenCalled();
  });

  test("toggleNodeCompletion rejects cross-book nodes (422)", async () => {
    mockNodeFindUnique.mockResolvedValue({
      ownerUnitId: "other-book",
      isDeleted: false,
    });
    const { progressService } = await import("./progress.service");
    await expect(
      progressService.toggleNodeCompletion("user-1", "book-1", "node-1", true),
    ).rejects.toThrow(/book/i);
    expect(mockNodeProgressUpsert).not.toHaveBeenCalled();
  });

  test("progressStats reads Meilisearch facets and fills missing buckets", async () => {
    mockProgressSearch.mockResolvedValue({
      estimatedTotalHits: 4,
      hits: [],
      facetDistribution: {
        status: { ACTIVE: 3, COMPLETED: 1 },
        progressBucket: { "0": 1, "2": 1, "8": 1, "9": 1 },
      },
    });
    const { progressService } = await import("./progress.service");

    const result = await progressService.progressStats("unit-1");

    expect(mockProgressSearch).toHaveBeenCalledWith("", {
      filter: ['unitId = "unit-1"'],
      facets: ["status", "progressBucket"],
      limit: 0,
    });
    expect(result.viewerCount).toBe(4);
    expect(result.statusCounts).toEqual({
      BACKLOG: 0,
      ACTIVE: 3,
      PAUSED: 0,
      COMPLETED: 1,
      DROPPED: 0,
    });
    expect(result.bucketCounts).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 1, 1]);
  });
});
