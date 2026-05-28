import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const now = new Date("2026-05-28T00:00:00.000Z");

function contextRow(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? "context-1",
    workUnitId: overrides.workUnitId ?? "work-1",
    realmUnitId: overrides.realmUnitId ?? "realm-1",
    role: overrides.role ?? "official",
    priority: overrides.priority ?? 0,
    locale: overrides.locale ?? null,
    releaseUnitId: overrides.releaseUnitId ?? null,
    createdByUserId: overrides.createdByUserId ?? null,
    updatedByUserId: overrides.updatedByUserId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

const unitFindUniqueMock = mock(async ({ where }: any): Promise<any> => {
  if (where.id === "work-1") {
    return { id: "work-1", type: "BOOK", status: "PUBLISHED" };
  }
  if (where.id === "realm-1") {
    return { id: "realm-1", type: "REALM", status: "PUBLISHED" };
  }
  if (where.id === "not-realm") {
    return { id: "not-realm", type: "TAG", status: "PUBLISHED" };
  }
  return null;
});
const unitWorkFindFirstMock = mock(async (): Promise<any> => null);
const workRealmContextCreateMock = mock(async ({ data }: any) =>
  contextRow(data),
);
const workRealmContextFindManyMock = mock(async (): Promise<any[]> => []);
const workRealmContextFindUniqueMock = mock(
  async (): Promise<any> => contextRow(),
);
const workRealmContextFindUniqueOrThrowMock = mock(
  async (): Promise<any> => contextRow(),
);
const workRealmContextUpdateMock = mock(async ({ data }: any) =>
  contextRow(data),
);
const workRealmContextDeleteMock = mock(async ({ where }: any) => where);

installPrismaClientMock();
Object.assign(prismaMock, {
  unit: {
    findUnique: unitFindUniqueMock,
  },
  unitWork: {
    findFirst: unitWorkFindFirstMock,
  },
  workRealmContext: {
    create: workRealmContextCreateMock,
    findMany: workRealmContextFindManyMock,
    findUnique: workRealmContextFindUniqueMock,
    findUniqueOrThrow: workRealmContextFindUniqueOrThrowMock,
    update: workRealmContextUpdateMock,
    delete: workRealmContextDeleteMock,
  },
});

mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    status: number;
    code?: string;
    details?: unknown;

    constructor(
      status: number,
      message: string,
      options?: { code?: string; details?: unknown },
    ) {
      super(message);
      this.status = status;
      this.code = options?.code;
      this.details = options?.details;
    }
  },
}));

const { WorkRealmContextService } = await import("./service");

describe("WorkRealmContextService", () => {
  const service = new WorkRealmContextService();

  beforeEach(() => {
    unitFindUniqueMock.mockClear();
    unitWorkFindFirstMock.mockClear();
    unitWorkFindFirstMock.mockImplementation(async () => null);
    workRealmContextCreateMock.mockClear();
    workRealmContextFindManyMock.mockClear();
    workRealmContextFindManyMock.mockImplementation(async () => []);
    workRealmContextFindUniqueMock.mockClear();
    workRealmContextFindUniqueOrThrowMock.mockClear();
    workRealmContextUpdateMock.mockClear();
    workRealmContextDeleteMock.mockClear();
  });

  test("creates a context only after work and realm validation", async () => {
    const row = await service.create(
      {
        workUnitId: "work-1",
        realmUnitId: "realm-1",
        role: "official",
        priority: 10,
      },
      "admin-1",
    );

    expect(row.realmUnitId).toBe("realm-1");
    expect(workRealmContextCreateMock).toHaveBeenCalledWith({
      data: {
        workUnitId: "work-1",
        realmUnitId: "realm-1",
        role: "official",
        priority: 10,
        locale: null,
        releaseUnitId: null,
        createdByUserId: "admin-1",
        updatedByUserId: "admin-1",
      },
    });
  });

  test("rejects non-REALM context targets", async () => {
    await expect(
      service.create({
        workUnitId: "work-1",
        realmUnitId: "not-realm",
        role: "official",
      }),
    ).rejects.toThrow("realmUnitId must be a REALM Unit");

    expect(workRealmContextCreateMock).not.toHaveBeenCalled();
  });

  test("rejects workUnitId when it is itself a release", async () => {
    (unitWorkFindFirstMock as any).mockImplementation(async ({ where }: any) =>
      where.unitId === "work-1" && where.role === "RELEASE"
        ? { workUnitId: "parent-work" }
        : null,
    );

    await expect(
      service.create({
        workUnitId: "work-1",
        realmUnitId: "realm-1",
        role: "official",
      }),
    ).rejects.toThrow("workUnitId cannot be a release Unit");

    expect(workRealmContextCreateMock).not.toHaveBeenCalled();
  });

  test("resolves release context through UnitWork and reports official conflicts", async () => {
    (unitWorkFindFirstMock as any).mockImplementation(async ({ where }: any) =>
      where.unitId === "release-1" && where.role === "RELEASE"
        ? { workUnitId: "work-1" }
        : null,
    );
    workRealmContextFindManyMock.mockImplementation(async () => [
      contextRow({ id: "official-a", role: "official", priority: 0 }),
      contextRow({
        id: "official-b",
        realmUnitId: "realm-2",
        role: "official",
        priority: 0,
      }),
      contextRow({
        id: "community-a",
        realmUnitId: "realm-3",
        role: "community",
        priority: 1,
      }),
    ]);

    const resolved = await service.resolveForRelease({
      releaseUnitId: "release-1",
      includeCommunity: true,
    });

    expect(resolved.workUnitId).toBe("work-1");
    expect(resolved.official?.id).toBe("official-a");
    expect(resolved.community.map((context) => context.id)).toEqual([
      "community-a",
    ]);
    expect(resolved.conflicts).toEqual([
      {
        code: "WORK_REALM_CONTEXT_CONFLICT",
        workUnitId: "work-1",
        role: "official",
        locale: null,
        releaseUnitId: "release-1",
        contextIds: ["official-a", "official-b"],
      },
    ]);
  });
});
