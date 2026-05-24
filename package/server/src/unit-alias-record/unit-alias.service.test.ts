import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

installPrismaClientMock();

const hasAuthorityOverMock = mock(async () => true);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("@/unit/authority", () => ({
  hasAuthorityOver: hasAuthorityOverMock,
}));
mock.module("@/middleware", () => ({
  isAdminRole: () => false,
  verifyAdminFromDb: async () => false,
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

function resetPrismaMock() {
  for (const key of Object.keys(prismaMock)) delete prismaMock[key];
  enqueueMock.mockClear();
  prismaMock.$transaction = mock(async (fn: any) => fn(prismaMock));
  prismaMock.unit = {
    findUnique: mock(async () => ({ id: "unit-1", userId: "owner-1" })),
    findUniqueOrThrow: mock(async () => ({ id: "unit-1" })),
  };
  prismaMock.unitAlias = {
    findUnique: mock(async () => ({
      id: "alias-1",
      unitId: "unit-1",
      value: "3 Body Problem",
      normalizedValue: "3 body problem",
      score: 1,
      voteCount: 1,
      pinned: false,
      status: "ACTIVE",
      kind: "COMMON",
      language: null,
      position: null,
      createdById: "user-1",
      updatedById: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
    findUniqueOrThrow: mock(async () => ({ id: "alias-1" })),
    upsert: mock(async () => ({ id: "alias-1", unitId: "unit-1" })),
    update: mock(async (args: any) => ({
      id: args.where.id,
      unitId: "unit-1",
      value: args.data?.value ?? "3 Body Problem",
      normalizedValue: args.data?.normalizedValue ?? "3 body problem",
      score: args.data?.score ?? 1,
      voteCount: args.data?.voteCount ?? 1,
      pinned: args.data?.pinned ?? false,
      status: args.data?.status ?? "ACTIVE",
      kind: args.data?.kind ?? "COMMON",
      language: args.data?.language ?? null,
      position: args.data?.position ?? null,
      createdById: "user-1",
      updatedById: args.data?.updatedById ?? "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
    delete: mock(async () => ({})),
  };
  prismaMock.unitAliasVote = {
    upsert: mock(async () => ({})),
    aggregate: mock(async () => ({
      _sum: { value: 1 },
      _count: { value: 1 },
    })),
  };
}

const actor = {
  userId: "owner-1",
  permission: { role: "USER" },
} as any;

const { normalizeUnitAliasValue } = await import("./normalizer");
const { UnitAliasService } = await import("./unit-alias.service");

describe("normalizeUnitAliasValue", () => {
  test("uses conservative normalization", () => {
    expect(normalizeUnitAliasValue("  ＴＢＰ　—  Book  ")).toBe("tbp - book");
  });
});

describe("UnitAliasService", () => {
  test("create de-duplicates by unitId and normalizedValue", async () => {
    resetPrismaMock();
    const service = new UnitAliasService();

    await service.create("user-1", {
      unitId: "unit-1",
      value: "  ＴＢＰ  ",
      kind: "ABBREVIATION",
    });

    const upsertArgs = prismaMock.unitAlias.upsert.mock.calls[0]?.[0] as any;
    expect(upsertArgs.where).toEqual({
      unitId_normalizedValue: {
        unitId: "unit-1",
        normalizedValue: "tbp",
      },
    });
    expect(upsertArgs.create.value).toBe("TBP");
    expect(upsertArgs.update).toEqual({});
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchAliases",
      "search.entity.patchAliases",
      "search.realm.patchAliases",
    ]);
  });

  test("castVote upserts one vote and recalculates aggregates", async () => {
    resetPrismaMock();
    prismaMock.unitAliasVote.aggregate.mockResolvedValueOnce({
      _sum: { value: -1 },
      _count: { value: 1 },
    });
    const service = new UnitAliasService();

    await service.castVote("user-1", "alias-1", -10);

    const voteArgs = prismaMock.unitAliasVote.upsert.mock.calls[0]?.[0] as any;
    expect(voteArgs.where).toEqual({
      aliasId_userId: { aliasId: "alias-1", userId: "user-1" },
    });
    expect(voteArgs.update.value).toBe(-1);
    const updateArgs = prismaMock.unitAlias.update.mock.calls[0]?.[0] as any;
    expect(updateArgs.data).toEqual({ score: -1, voteCount: 1 });
  });

  test("pinning is authority-gated and does not change score", async () => {
    resetPrismaMock();
    const service = new UnitAliasService();

    await service.setPin("alias-1", { pinned: true, position: "a0" }, actor);

    const updateArgs = prismaMock.unitAlias.update.mock.calls[0]?.[0] as any;
    expect(updateArgs.data).toEqual({
      pinned: true,
      position: "a0",
      updatedById: "owner-1",
    });
  });

  test("regular users cannot manage aliases without authority", async () => {
    resetPrismaMock();
    hasAuthorityOverMock.mockResolvedValueOnce(false);
    const service = new UnitAliasService();

    await expect(
      service.setPin("alias-1", { pinned: true }, actor),
    ).rejects.toThrow("Unit alias management requires admin or unit authority");
  });

  test("hide and delete use management paths", async () => {
    resetPrismaMock();
    const service = new UnitAliasService();

    await service.hide("alias-1", actor);
    await service.delete("alias-1", actor);

    const hideArgs = prismaMock.unitAlias.update.mock.calls[0]?.[0] as any;
    expect(hideArgs.data.status).toBe("HIDDEN");
    expect(prismaMock.unitAlias.delete).toHaveBeenCalledWith({
      where: { id: "alias-1" },
    });
  });
});
