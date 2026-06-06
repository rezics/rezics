import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ProgressRepository } from "./progress.service";

const baseRow: any = {
  userId: "user-1",
  unitId: "unit-1",
  progress: 0,
  status: "BACKLOG",
  isDeleted: false,
  completedCount: 0,
  totalTimeMs: 0,
  lastReadNodeId: null,
  lastReadAnchor: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  extra: null,
};

const enqueueMock = mock(async (_command: any) => ({
  status: "created" as const,
}));
const mockProgressSearch = mock(async () => ({
  estimatedTotalHits: 0,
  hits: [],
  facetDistribution: {},
}));

class TestAppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; details?: unknown },
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;
  }
}

mock.module("@rezics/search", () => ({
  PROGRESS_BUCKET_COUNT: 10,
}));

mock.module("@/utils/errors", () => ({
  AppError: TestAppError,
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/meili/search-client", () => ({
  searchClient: {
    progressIndex: {
      search: mockProgressSearch,
    },
  },
}));

function firstArg(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls[0]?.[0] as any;
}

function createHarness(
  input: {
    upsertRow?: any;
    progressState?: any;
    progressRows?: any[];
    shelfRows?: any[];
    contentNode?: any;
  } = {},
) {
  const repository: ProgressRepository = {
    findProgressState: mock(async () => input.progressState ?? null),
    findProgress: mock(async () => input.upsertRow ?? baseRow),
    findContentNode: mock(async () => input.contentNode ?? null),
    upsertProgress: mock(async () => input.upsertRow ?? baseRow),
    listProgressRows: mock(async () => input.progressRows ?? []),
    findShelfLinks: mock(async () => input.shelfRows ?? []),
    softDeleteProgress: mock(async () => {}),
    upsertNodeCompletion: mock(async () => {}),
    deleteNodeCompletion: mock(async () => {}),
  };
  return { repository };
}

async function createService(repository: ProgressRepository) {
  const { ProgressService } = await import("./progress.service");
  return new ProgressService(repository);
}

describe("ProgressService", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    mockProgressSearch.mockClear();
    mockProgressSearch.mockResolvedValue({
      estimatedTotalHits: 0,
      hits: [],
      facetDistribution: {},
    });
  });

  test("first-time upsert creates defaults and additive time", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", { addTimeMs: 2500 });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.userId).toBe("user-1");
    expect(args.unitId).toBe("unit-1");
    expect(args.create.progress).toBe(0);
    expect(args.create.status).toBe("BACKLOG");
    expect(args.create.isDeleted).toBe(false);
    expect(args.create.completedCount).toBe(0);
    expect(args.create.totalTimeMs).toBe(2500);
    expect(args.create.lastReadNodeId).toBeUndefined();
    expect(args.create.lastReadAnchor).toBeUndefined();
    expect(args.update.totalTimeMsIncrement).toBe(2500);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.progress.sync",
        payload: { userId: "user-1", unitId: "unit-1" },
        source: { type: "server", service: "progress" },
      }),
    );
  });

  test("partial upsert preserves untouched fields in update branch", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", {
      progress: 0.42,
      addTimeMs: 100,
    });

    const update = firstArg(repository.upsertProgress as any).update;
    expect(update.progress).toBe(0.42);
    expect(update.isDeleted).toBe(false);
    expect(update.totalTimeMsIncrement).toBe(100);
    expect(update.status).toBeUndefined();
    expect(update.completedCount).toBeUndefined();
    expect(update.lastReadNodeId).toBeUndefined();
    expect(update.lastReadAnchor).toBeUndefined();
    expect(update.extra).toBeUndefined();
  });

  test("persists lastReadNodeId via direct node id", async () => {
    const { repository } = createHarness({
      contentNode: { isDeleted: false, ownerUnitId: "book-1" },
    });
    const service = await createService(repository);

    await service.upsert("user-1", "book-1", {
      lastReadNodeId: "node-1",
      lastReadAnchor: { text: "Opening" },
    });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.create.lastReadNodeId).toBe("node-1");
    expect(args.create.lastReadAnchor).toEqual({ text: "Opening" });
    expect(args.update.lastReadNodeId).toBe("node-1");
    expect(args.update.lastReadAnchor).toEqual({ text: "Opening" });
  });

  test("rejects upserts whose lastReadNodeId points to a deleted node", async () => {
    const { repository } = createHarness({
      contentNode: { isDeleted: true, ownerUnitId: "book-1" },
    });
    const service = await createService(repository);

    await expect(
      service.upsert("user-1", "book-1", {
        lastReadNodeId: "node-deleted",
      }),
    ).rejects.toThrow(/deleted/i);
    expect(repository.upsertProgress).not.toHaveBeenCalled();
  });

  test("rejects invalid progress and negative addTimeMs", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await expect(
      service.upsert("user-1", "unit-1", { progress: 1.1 }),
    ).rejects.toThrow(/progress/);
    await expect(
      service.upsert("user-1", "unit-1", { addTimeMs: -1 }),
    ).rejects.toThrow(/addTimeMs/);
    await expect(
      service.upsert("user-1", "unit-1", { completedCount: -1 }),
    ).rejects.toThrow(/completedCount/);
    expect(repository.upsertProgress).not.toHaveBeenCalled();
  });

  test("accepts narrow paused extra", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", {
      status: "PAUSED",
      extra: { paused: { reasonPostUnitIds: ["post-1"] } },
    });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.create.extra).toEqual({
      paused: { reasonPostUnitIds: ["post-1"] },
    });
    expect(args.update.extra).toEqual({
      paused: { reasonPostUnitIds: ["post-1"] },
    });
  });

  test("rejects extra with unknown top-level key", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await expect(
      service.upsert("user-1", "unit-1", {
        extra: { foo: { bar: 1 } } as never,
      }),
    ).rejects.toThrow(/extra/);
    expect(repository.upsertProgress).not.toHaveBeenCalled();
  });

  test("coerces completed status when progress reaches 1 without explicit status", async () => {
    const { repository } = createHarness({
      progressState: { status: "ACTIVE", completedCount: 2 },
    });
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", { progress: 1 });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.create.status).toBe("COMPLETED");
    expect(args.create.completedCount).toBe(3);
    expect(args.update.status).toBe("COMPLETED");
    expect(args.update.completedCount).toBe(3);
  });

  test("does not increment completed count when already completed", async () => {
    const { repository } = createHarness({
      progressState: { status: "COMPLETED", completedCount: 2 },
    });
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", {
      status: "COMPLETED",
    });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.update.status).toBe("COMPLETED");
    expect(args.update.completedCount).toBeUndefined();
  });

  test("creates completed row with count 1 on first completion", async () => {
    const { repository } = createHarness({ progressState: null });
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", {
      status: "COMPLETED",
    });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.create.status).toBe("COMPLETED");
    expect(args.create.completedCount).toBe(1);
    expect(args.update.completedCount).toBe(1);
  });

  test("allows explicit completed count override", async () => {
    const { repository } = createHarness({
      progressState: { status: "ACTIVE", completedCount: 2 },
    });
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", {
      status: "COMPLETED",
      completedCount: 7,
    });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.create.completedCount).toBe(7);
    expect(args.update.completedCount).toBe(7);
  });

  test("supports paused status", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", {
      status: "PAUSED",
    });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.create.status).toBe("PAUSED");
    expect(args.update.status).toBe("PAUSED");
  });

  test("explicit status wins over progress coercion", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await service.upsert("user-1", "unit-1", {
      progress: 1,
      status: "DROPPED",
    });

    const args = firstArg(repository.upsertProgress as any);
    expect(args.create.status).toBe("DROPPED");
    expect(args.update.status).toBe("DROPPED");
  });

  test("delete soft-deletes progress and removes it from search", async () => {
    const { repository } = createHarness();
    const service = await createService(repository);

    await service.delete("user-1", "unit-1");

    expect(repository.softDeleteProgress).toHaveBeenCalledWith(
      "user-1",
      "unit-1",
      expect.any(Date),
    );
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
    const { repository } = createHarness({ progressRows: rows });
    const service = await createService(repository);

    const result = await service.list("user-1", { limit: 1 });

    expect(repository.listProgressRows).toHaveBeenCalledWith({
      userId: "user-1",
      cursorDate: null,
      cursorUnitId: null,
      take: 2,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.nextCursor).toBeTruthy();
  });

  test("listLibrary hydrates progress-owned unit cards without shelf membership", async () => {
    const { repository } = createHarness({
      progressRows: [
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
      ],
    });
    const service = await createService(repository);

    const result = await service.listLibrary("user-1", { limit: 10 });

    expect(repository.findShelfLinks).toHaveBeenCalledWith("user-1", [
      "variant-1",
    ]);
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
    const { repository } = createHarness({
      progressRows: [
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
      ],
      shelfRows: [
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
      ],
    });
    const service = await createService(repository);

    const result = await service.listLibrary("user-1", { limit: 10 });

    expect(result.rows[0]?.shelves).toEqual([
      { shelfId: "direct-shelf", title: "Direct Shelf" },
      { shelfId: "context-shelf", title: "Context Shelf" },
    ]);
  });

  test("listLibrary preserves variant book id and last-read node in resume routes", async () => {
    const { repository } = createHarness({
      progressRows: [
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
      ],
    });
    const service = await createService(repository);

    const result = await service.listLibrary("user-1", { limit: 10 });

    expect(result.rows[0]?.resumeRoute).toEqual({
      kind: "node",
      bookId: "variant-1",
      nodeId: "node-1",
    });
  });

  test("toggleNodeCompletion (on) upserts a progress row", async () => {
    const { repository } = createHarness({
      contentNode: { ownerUnitId: "book-1", isDeleted: false },
    });
    const service = await createService(repository);

    await service.toggleNodeCompletion("user-1", "book-1", "node-1", true);

    expect(repository.upsertNodeCompletion).toHaveBeenCalledWith(
      "user-1",
      "node-1",
    );
    expect(repository.deleteNodeCompletion).not.toHaveBeenCalled();
  });

  test("toggleNodeCompletion (off) deletes the progress row", async () => {
    const { repository } = createHarness({
      contentNode: { ownerUnitId: "book-1", isDeleted: false },
    });
    const service = await createService(repository);

    await service.toggleNodeCompletion("user-1", "book-1", "node-1", false);

    expect(repository.deleteNodeCompletion).toHaveBeenCalledWith(
      "user-1",
      "node-1",
    );
    expect(repository.upsertNodeCompletion).not.toHaveBeenCalled();
  });

  test("toggleNodeCompletion rejects deleted nodes (409)", async () => {
    const { repository } = createHarness({
      contentNode: { ownerUnitId: "book-1", isDeleted: true },
    });
    const service = await createService(repository);

    await expect(
      service.toggleNodeCompletion("user-1", "book-1", "node-1", true),
    ).rejects.toThrow(/deleted/i);
    expect(repository.upsertNodeCompletion).not.toHaveBeenCalled();
  });

  test("toggleNodeCompletion rejects cross-book nodes (422)", async () => {
    const { repository } = createHarness({
      contentNode: { ownerUnitId: "other-book", isDeleted: false },
    });
    const service = await createService(repository);

    await expect(
      service.toggleNodeCompletion("user-1", "book-1", "node-1", true),
    ).rejects.toThrow(/book/i);
    expect(repository.upsertNodeCompletion).not.toHaveBeenCalled();
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
    const { repository } = createHarness();
    const service = await createService(repository);

    const result = await service.progressStats("unit-1");

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
