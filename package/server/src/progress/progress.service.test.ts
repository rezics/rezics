import { beforeEach, describe, expect, mock, test } from "bun:test";

const UserUnitProgressStatus = {
  BACKLOG: "BACKLOG",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;

const baseRow = {
  userId: "user-1",
  unitId: "unit-1",
  progress: 0,
  status: UserUnitProgressStatus.BACKLOG,
  totalTimeMs: 0n,
  lastPosition: null,
  firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
  extra: null,
};

const mockUpsert = mock(async () => baseRow);
const mockFindUnique = mock(async () => baseRow);
const mockFindMany = mock(async () => [] as typeof baseRow[]);
const mockDeleteMany = mock(async () => ({ count: 0 }));

function firstArg(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls[0]?.[0] as any;
}

mock.module("#/prisma/client", () => ({
  UserUnitProgressStatus,
  prisma: {
    userUnitProgress: {
      upsert: mockUpsert,
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      deleteMany: mockDeleteMany,
    },
  },
}));

describe("ProgressService", () => {
  beforeEach(() => {
    mockUpsert.mockClear();
    mockFindUnique.mockClear();
    mockFindMany.mockClear();
    mockDeleteMany.mockClear();
    mockUpsert.mockResolvedValue(baseRow);
    mockFindUnique.mockResolvedValue(baseRow);
    mockFindMany.mockResolvedValue([]);
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
    expect(args.create.totalTimeMs).toBe(2500n);
    expect(args.create.lastPosition).toBeNull();
    expect(args.update.totalTimeMs).toEqual({ increment: 2500n });
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
    expect(update.lastPosition).toBeUndefined();
    expect(update.extra).toBeUndefined();
  });

  test("rejects invalid progress and negative addTimeMs", async () => {
    const { progressService } = await import("./progress.service");

    await expect(
      progressService.upsert("user-1", "unit-1", { progress: 1.1 }),
    ).rejects.toThrow(/progress/);
    await expect(
      progressService.upsert("user-1", "unit-1", { addTimeMs: -1 }),
    ).rejects.toThrow(/addTimeMs/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test("coerces completed status when progress reaches 1 without explicit status", async () => {
    const { progressService } = await import("./progress.service");

    await progressService.upsert("user-1", "unit-1", { progress: 1 });

    const args = firstArg(mockUpsert);
    expect(args.create.status).toBe("COMPLETED");
    expect(args.update.status).toBe("COMPLETED");
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
});
