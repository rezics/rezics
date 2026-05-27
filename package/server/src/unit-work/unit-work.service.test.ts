import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const unitFindUniqueMock = mock(async ({ where }: any): Promise<any> => {
  if (where.id === "release-1") {
    return { id: "release-1", type: "BOOK", status: "PUBLISHED" };
  }
  if (where.id === "post-1") {
    return { id: "post-1", type: "POST", status: "PUBLISHED" };
  }
  if (where.id === "work-1") {
    return {
      id: "work-1",
      type: "BOOK",
      status: "PUBLISHED",
    };
  }
  if (where.id === "work-2") {
    return {
      id: "work-2",
      type: "BOOK",
      status: "PUBLISHED",
    };
  }
  if (where.id === "nested-release") {
    return {
      id: "nested-release",
      type: "BOOK",
      status: "PUBLISHED",
    };
  }
  return null;
});

const unitUpdateMock = mock(async (args: any) => args);
const unitWorkFindFirstMock = mock(async (): Promise<any> => null);
const unitWorkFindManyMock = mock(async (args?: any): Promise<any[]> => {
  if (args?.where?.role === "RELEASE") {
    return [{ workUnitId: "work-1" }, { workUnitId: "work-2" }];
  }
  return [];
});
const unitWorkUpsertMock = mock(
  async (args: any): Promise<any> => ({
    unitId: args.create.unitId,
    workUnitId: args.create.workUnitId,
    role: args.create.role,
    language: args.create.language ?? null,
    position: args.create.position ?? null,
    displayPolicy: args.create.displayPolicy,
    createdAt: new Date("2026-05-27T00:00:00.000Z"),
    updatedAt: new Date("2026-05-27T00:00:00.000Z"),
  }),
);
const unitWorkUpdateMock = mock(async (args: any): Promise<any> => args.data);
const unitWorkDeleteMock = mock(async (args: any): Promise<any> => args.where);
const queryRawMock = mock(async (): Promise<any[]> => []);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const transactionMock = mock(async (arg: any) => {
  if (Array.isArray(arg)) return Promise.all(arg);
  return arg({
    unit: {
      update: unitUpdateMock,
    },
    unitWork: {
      findFirst: unitWorkFindFirstMock,
      upsert: unitWorkUpsertMock,
      delete: unitWorkDeleteMock,
    },
  });
});

installPrismaClientMock();
Object.assign(prismaMock, {
  $queryRaw: queryRawMock,
  $transaction: transactionMock,
  unit: {
    findUnique: unitFindUniqueMock,
    update: unitUpdateMock,
  },
  unitWork: {
    findFirst: unitWorkFindFirstMock,
    findMany: unitWorkFindManyMock,
    upsert: unitWorkUpsertMock,
    update: unitWorkUpdateMock,
    delete: unitWorkDeleteMock,
  },
});

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const { UnitWorkService } = await import("./unit-work.service");

describe("UnitWorkService", () => {
  const service = new UnitWorkService();

  beforeEach(() => {
    unitFindUniqueMock.mockClear();
    unitUpdateMock.mockClear();
    unitWorkFindFirstMock.mockClear();
    unitWorkFindFirstMock.mockImplementation(async () => null);
    unitWorkFindManyMock.mockClear();
    unitWorkUpsertMock.mockClear();
    unitWorkUpdateMock.mockClear();
    unitWorkDeleteMock.mockClear();
    queryRawMock.mockClear();
    enqueueMock.mockClear();
    transactionMock.mockClear();
  });

  test("creates release membership through UnitWork only", async () => {
    await service.create({
      unitId: "release-1",
      workUnitId: "work-1",
      role: "RELEASE",
      language: "en",
      position: "a0",
      displayPolicy: "PRIMARY",
    });

    expect(unitWorkUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          unitId_workUnitId_role: {
            unitId: "release-1",
            workUnitId: "work-1",
            role: "RELEASE",
          },
        },
      }),
    );
    expect(unitUpdateMock).not.toHaveBeenCalled();
    expect(enqueueMock.mock.calls.map((call) => call[0])).toMatchObject([
      {
        kind: "search.content.sync",
        payload: { unitId: "release-1" },
      },
      {
        kind: "search.post.sync",
        payload: { postId: "release-1" },
      },
      {
        kind: "search.content.syncWorkReleases",
        payload: { targetId: "work-1" },
      },
    ]);
  });

  test("rejects duplicate release membership in another work", async () => {
    unitWorkFindFirstMock.mockImplementation(async ({ where }: any) =>
      where.unitId === "release-1" ? { workUnitId: "work-2" } : null,
    );

    await expect(
      service.create({
        unitId: "release-1",
        workUnitId: "work-1",
        role: "RELEASE",
      }),
    ).rejects.toThrow("Release already belongs to another work domain");
  });

  test("allows content membership in multiple work domains", async () => {
    await service.reconcileContentMemberships("post-1", "POST", [
      "release-1",
      "release-2",
    ]);

    expect(unitWorkUpsertMock.mock.calls.map((call) => call[0].create)).toEqual(
      [
        {
          unitId: "post-1",
          workUnitId: "work-1",
          role: "POST",
          displayPolicy: "PRIMARY",
        },
        {
          unitId: "post-1",
          workUnitId: "work-2",
          role: "POST",
          displayPolicy: "PRIMARY",
        },
      ],
    );
    expect(enqueueMock.mock.calls.map((call) => call[0])).toMatchObject([
      {
        kind: "search.content.sync",
        payload: { unitId: "post-1" },
      },
      {
        kind: "search.post.sync",
        payload: { postId: "post-1" },
      },
      {
        kind: "search.content.syncWorkReleases",
        payload: { targetId: "work-1" },
      },
      {
        kind: "search.content.sync",
        payload: { unitId: "post-1" },
      },
      {
        kind: "search.post.sync",
        payload: { postId: "post-1" },
      },
      {
        kind: "search.content.syncWorkReleases",
        payload: { targetId: "work-2" },
      },
    ]);
  });

  test("rejects release-to-release nesting", async () => {
    unitWorkFindFirstMock.mockImplementation(async ({ where }: any) =>
      where.unitId === "nested-release" ? { workUnitId: "work-1" } : null,
    );

    await expect(
      service.create({
        unitId: "release-1",
        workUnitId: "nested-release",
        role: "RELEASE",
      }),
    ).rejects.toThrow("Work Unit cannot itself be a release");
  });

  test("lists memberships in position order", async () => {
    await service.list({ workUnitId: "work-1", role: "RELEASE" });

    expect(unitWorkFindManyMock).toHaveBeenCalledWith({
      where: { workUnitId: "work-1", role: "RELEASE" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { unitId: "asc" }],
      take: 50,
    });
  });
});
