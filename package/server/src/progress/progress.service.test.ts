import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
  UserUnitProgressStatus,
} from "@/test/prisma-client-mock";

const baseRow = {
  userId: "user-1",
  unitId: "unit-1",
  progress: 0,
  status: UserUnitProgressStatus.BACKLOG,
  completedCount: 0,
  totalTimeMs: 0n,
  lastPosition: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  extra: null,
};

const mockUpsert = mock(async () => baseRow);
const mockFindUnique = mock(async () => baseRow);
const mockFindMany = mock(async () => [] as (typeof baseRow)[]);
const mockDeleteMany = mock(async () => ({ count: 0 }));
const mockSyncProgress = mock(async () => undefined);
const mockRemoveProgress = mock(async () => undefined);
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
  removeProgress: mockRemoveProgress,
  syncProgress: mockSyncProgress,
}));

installPrismaClientMock();
Object.assign(prismaMock, {
  userUnitProgress: {
    upsert: mockUpsert,
    findUnique: mockFindUnique,
    findMany: mockFindMany,
    deleteMany: mockDeleteMany,
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
    mockDeleteMany.mockClear();
    mockSyncProgress.mockClear();
    mockRemoveProgress.mockClear();
    mockProgressSearch.mockClear();
    mockUpsert.mockResolvedValue(baseRow);
    mockFindUnique.mockResolvedValue(baseRow);
    mockFindMany.mockResolvedValue([]);
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
    expect(args.create.completedCount).toBe(0);
    expect(args.create.totalTimeMs).toBe(2500n);
    expect(args.create.lastPosition).toBeNull();
    expect(args.update.totalTimeMs).toEqual({ increment: 2500n });
    expect(mockSyncProgress).toHaveBeenCalledWith(expect.anything(), baseRow);
  });

  test("partial upsert preserves untouched fields in update branch", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", {
      progress: 0.42,
      addTimeMs: 100,
    });

    const update = firstArg(mockUpsert).update;
    expect(update.progress).toBe(0.42);
    expect(update.totalTimeMs).toEqual({ increment: 100n });
    expect(update.status).toBeUndefined();
    expect(update.completedCount).toBeUndefined();
    expect(update.lastPosition).toBeUndefined();
    expect(update.extra).toBeUndefined();
  });

  test("persists typed JSON lastPosition values", async () => {
    const { progressService } = await import("./progress.service");
    const lastPosition = {
      kind: "contentStructurePath" as const,
      bookUnitId: "book-1",
      path: [0, 2],
      chapterUnitId: "chapter-1",
    };

    await progressService.upsert("user-1", "book-1", {
      lastPosition,
    });

    const args = firstArg(mockUpsert);
    expect(args.create.lastPosition).toEqual(lastPosition);
    expect(args.update.lastPosition).toEqual(lastPosition);
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

  test("delete is idempotent through deleteMany scoped by user and unit", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.delete("user-1", "unit-1");

    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", unitId: "unit-1" },
    });
    expect(mockRemoveProgress).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "unit-1",
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
    expect(args.where).toEqual({ userId: "user-1" });
    expect(args.orderBy).toEqual([{ lastSeenAt: "desc" }, { unitId: "desc" }]);
    expect(args.take).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.nextCursor).toBeTruthy();
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
