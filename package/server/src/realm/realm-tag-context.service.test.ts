import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const unitFindUniqueMock = mock(async ({ where }: any) => {
  if (where.id === "realm-1") {
    return {
      id: "realm-1",
      type: "REALM",
      userId: "owner-1",
      realm: { unitId: "realm-1" },
    };
  }
  if (where.id === "tag-1") return { id: "tag-1", type: "TAG" };
  if (where.id === "book-1") return { id: "book-1", type: "BOOK" };
  return null;
});
const unitCreateMock = mock(async () => ({ id: "context-unit-1" }));
const postCreateMock = mock(async () => ({ unitId: "context-unit-1" }));
const memberFindFirstMock = mock(async () => ({ realmUnitId: "realm-1" }));
const contextFindUniqueMock = mock(async () => null);
const contextFindUniqueOrThrowMock = mock(async () => ({
  realmUnitId: "realm-1",
  tagUnitId: "tag-1",
  contextUnitId: "existing-context",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const contextUpsertMock = mock(async ({ create, update }: any) => ({
  ...create,
  ...update,
  contextUnitId: update?.contextUnitId ?? create.contextUnitId ?? null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const contextUpdateMock = mock(async ({ data }: any) => ({
  realmUnitId: "realm-1",
  tagUnitId: "tag-1",
  contextUnitId: data.contextUnitId,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const transactionMock = mock(async (fn: any) =>
  fn({
    unit: { findUnique: unitFindUniqueMock, create: unitCreateMock },
    post: { create: postCreateMock },
    realmTagContext: {
      upsert: contextUpsertMock,
      update: contextUpdateMock,
      findUniqueOrThrow: contextFindUniqueOrThrowMock,
    },
  }),
);

Object.assign(prismaMock, {
  $transaction: transactionMock,
  unit: { findUnique: unitFindUniqueMock, create: unitCreateMock },
  post: { create: postCreateMock },
  realmMember: { findFirst: memberFindFirstMock },
  realmTagApplication: { create: mock(async () => ({})) },
  realmTagContext: {
    findUnique: contextFindUniqueMock,
    upsert: contextUpsertMock,
    update: contextUpdateMock,
    findUniqueOrThrow: contextFindUniqueOrThrowMock,
  },
});

const { RealmTagContextError, RealmTagContextService } = await import(
  "./realm-tag-context.service"
);

const service = new RealmTagContextService();

describe("RealmTagContextService", () => {
  beforeEach(() => {
    unitFindUniqueMock.mockClear();
    unitCreateMock.mockClear();
    postCreateMock.mockClear();
    memberFindFirstMock.mockClear();
    memberFindFirstMock.mockResolvedValue({ realmUnitId: "realm-1" });
    contextFindUniqueMock.mockClear();
    contextFindUniqueMock.mockResolvedValue(null);
    contextUpsertMock.mockClear();
    contextUpdateMock.mockClear();
    contextFindUniqueOrThrowMock.mockClear();
    transactionMock.mockClear();
    (prismaMock.realmTagApplication.create as any).mockClear();
  });

  test("returns null for a missing context without creating RealmTagApplication", async () => {
    const row = await service.get("realm-1", "tag-1");
    expect(row).toBeNull();
    expect(contextFindUniqueMock).toHaveBeenCalled();
    expect(prismaMock.realmTagApplication.create).not.toHaveBeenCalled();
  });

  test("rejects invalid realm and tag unit types", async () => {
    await expect(
      service.assertRealmAndTagTypes("book-1", "realm-1"),
    ).rejects.toBeInstanceOf(RealmTagContextError);
  });

  test("upserts context metadata without creating RealmTagApplication", async () => {
    const row = await service.upsert("realm-1", "tag-1", {
      contextUnitId: "context-unit-1",
    });
    expect(row.contextUnitId).toBe("context-unit-1");
    expect(contextUpsertMock.mock.calls[0]?.[0].where).toEqual({
      realmUnitId_tagUnitId: {
        realmUnitId: "realm-1",
        tagUnitId: "tag-1",
      },
    });
    expect(prismaMock.realmTagApplication.create).not.toHaveBeenCalled();
  });

  test("materializes exactly one POST content Unit when missing", async () => {
    contextUpsertMock.mockResolvedValueOnce({
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      contextUnitId: null,
    });

    const row = await service.materialize("user-1", "realm-1", "tag-1");

    expect(unitCreateMock).toHaveBeenCalledTimes(1);
    expect(postCreateMock).toHaveBeenCalledTimes(1);
    expect(contextUpdateMock).toHaveBeenCalledTimes(1);
    expect(row.contextUnitId).toBe("context-unit-1");
  });

  test("materialization returns existing contextUnitId idempotently", async () => {
    contextUpsertMock.mockResolvedValueOnce({
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      contextUnitId: "existing-context",
    });

    const row = await service.materialize("user-1", "realm-1", "tag-1");

    expect(unitCreateMock).not.toHaveBeenCalled();
    expect(postCreateMock).not.toHaveBeenCalled();
    expect(contextUpdateMock).not.toHaveBeenCalled();
    expect(row.contextUnitId).toBe("existing-context");
  });

  test("requires moderator-or-owner permission for context writes", async () => {
    memberFindFirstMock.mockResolvedValueOnce(null);

    const allowed = await service.canManageContext(
      { userId: "stranger", permission: { role: "USER" } } as any,
      "realm-1",
    );

    expect(allowed).toBe(false);
  });
});
