import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const findManyMock = mock((_args?: unknown) =>
  Promise.resolve([] as unknown[]),
);
const unitFindUniqueMock = mock(async ({ where }: any) => {
  if (where.id === "realm-1" || where.id === "realm-2") {
    return { id: where.id, type: "REALM", realm: { unitId: where.id } };
  }
  if (where.id === "tag-1") return { id: "tag-1", type: "TAG" };
  if (where.id === "book-1") return { id: "book-1", type: "BOOK" };
  return null;
});
const realmUnitCreateMock = mock(async () => ({}));
const realmUnitDeleteMock = mock(async () => ({}));
const realmUnitFindManyMock = mock(async () => []);
const realmTagUnitUpsertMock = mock(async ({ create }: any) => ({
  ...create,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const realmTagUnitUpdateMock = mock(async ({ where, data }: any) => ({
  realmUnitId: where.realmUnitId_tagUnitId_unitId.realmUnitId,
  tagUnitId: where.realmUnitId_tagUnitId_unitId.tagUnitId,
  unitId: where.realmUnitId_tagUnitId_unitId.unitId,
  pinned: false,
  position: null,
  score: data.score,
  voteCount: data.voteCount,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const realmTagUnitDeleteMock = mock(async () => ({}));
const realmTagVoteFindUniqueMock = mock(async () => null);
const realmTagVoteCreateMock = mock(async () => ({}));
const realmTagVoteDeleteManyMock = mock(async () => ({ count: 0 }));
const realmTagVoteAggregateMock = mock(async () => ({
  _sum: { value: 1 },
  _count: { value: 1 },
}));
const tagVoteFindUniqueMock = mock(async () => null);
const tagVoteCreateMock = mock(async () => ({}));
const tagVoteAggregateMock = mock(async () => ({
  _sum: { value: 1 },
  _count: { value: 1 },
}));
const unitTagUpsertMock = mock(async () => ({}));
const unitTagUpdateMock = mock(async () => ({}));
const transactionMock = mock(async (fn: any) =>
  fn({
    unit: { findUnique: unitFindUniqueMock },
    realmUnit: {
      create: realmUnitCreateMock,
      delete: realmUnitDeleteMock,
      findMany: realmUnitFindManyMock,
    },
    realmTagUnit: {
      findMany: findManyMock,
      upsert: realmTagUnitUpsertMock,
      update: realmTagUnitUpdateMock,
      delete: realmTagUnitDeleteMock,
    },
    realmTagVote: {
      findUnique: realmTagVoteFindUniqueMock,
      create: realmTagVoteCreateMock,
      deleteMany: realmTagVoteDeleteManyMock,
      aggregate: realmTagVoteAggregateMock,
      upsert: mock(async () => ({})),
    },
    tagVote: {
      findUnique: tagVoteFindUniqueMock,
      create: tagVoteCreateMock,
      aggregate: tagVoteAggregateMock,
    },
    unitTag: {
      upsert: unitTagUpsertMock,
      update: unitTagUpdateMock,
    },
  }),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  unit: { findUnique: unitFindUniqueMock },
  realmUnit: {
    create: realmUnitCreateMock,
    delete: realmUnitDeleteMock,
    findMany: realmUnitFindManyMock,
  },
  realmTagUnit: {
    findMany: findManyMock,
    upsert: realmTagUnitUpsertMock,
    update: realmTagUnitUpdateMock,
    delete: realmTagUnitDeleteMock,
  },
  realmTagVote: {
    findUnique: realmTagVoteFindUniqueMock,
    create: realmTagVoteCreateMock,
    deleteMany: realmTagVoteDeleteManyMock,
    aggregate: realmTagVoteAggregateMock,
  },
  tagVote: {
    findUnique: tagVoteFindUniqueMock,
    create: tagVoteCreateMock,
    aggregate: tagVoteAggregateMock,
  },
  unitTag: { upsert: unitTagUpsertMock, update: unitTagUpdateMock },
});

mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: async () => undefined,
  patchContentCreditsToMeili: async () => undefined,
  patchContentMetadataToMeili: async () => undefined,
  patchContentTagsToMeili: async () => undefined,
  patchContentTranslationsToMeili: async () => undefined,
  patchContentRealmIdsToMeili: async () => undefined,
  patchContentRealmTagKeysToMeili: async () => undefined,
  syncContentToMeili: async () => undefined,
}));

mock.module("@/meili/realm/sync", () => ({
  deleteRealmFromMeili: async () => undefined,
  patchRealmMemberCountToMeili: async () => undefined,
  patchRealmMetadataToMeili: async () => undefined,
  patchRealmTranslationsToMeili: async () => undefined,
  syncAllRealmsToMeili: async () => undefined,
  syncRealmToMeili: async () => undefined,
}));

const { RealmService, REALM_TAG_VISIBILITY_THRESHOLD } = await import(
  "./realm.service"
);

function resetWriteMocks() {
  unitFindUniqueMock.mockClear();
  realmUnitCreateMock.mockClear();
  realmUnitDeleteMock.mockClear();
  realmUnitFindManyMock.mockClear();
  realmTagUnitUpsertMock.mockClear();
  realmTagUnitUpdateMock.mockClear();
  realmTagUnitDeleteMock.mockClear();
  realmTagVoteFindUniqueMock.mockClear();
  realmTagVoteFindUniqueMock.mockResolvedValue(null);
  realmTagVoteCreateMock.mockClear();
  realmTagVoteDeleteManyMock.mockClear();
  realmTagVoteAggregateMock.mockClear();
  tagVoteFindUniqueMock.mockClear();
  tagVoteFindUniqueMock.mockResolvedValue(null);
  tagVoteCreateMock.mockClear();
  tagVoteAggregateMock.mockClear();
  unitTagUpsertMock.mockClear();
  unitTagUpdateMock.mockClear();
  transactionMock.mockClear();
}

describe("RealmService.listRealmTagsForUnit", () => {
  const service = new RealmService();

  test("regular caller filters out below-threshold rows", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listRealmTagsForUnit("realm-1", "unit-x");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({
      realmUnitId: "realm-1",
      unitId: "unit-x",
      score: { gt: REALM_TAG_VISIBILITY_THRESHOLD },
    });
  });

  test("privileged caller sees below-threshold rows", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listRealmTagsForUnit("realm-1", "unit-x", {
      includeBelowThreshold: true,
    });
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({ realmUnitId: "realm-1", unitId: "unit-x" });
  });

  test("orders pin-first then position asc then score desc", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listRealmTagsForUnit("realm-1", "unit-x");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.orderBy).toEqual([
      { pinned: "desc" },
      { position: "asc" },
      { score: "desc" },
      { tagUnitId: "asc" },
    ]);
  });
});

describe("RealmService.listLowScoreRealmTagUnits", () => {
  const service = new RealmService();

  test("queries score <= threshold, ordered ascending", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagUnits(-100, 50);
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({ score: { lte: -100 } });
    expect(args.orderBy).toEqual([
      { score: "asc" },
      { realmUnitId: "asc" },
      { unitId: "asc" },
      { tagUnitId: "asc" },
    ]);
    expect(args.take).toBe(50);
  });

  test("constrains to a single realm when realmUnitId is provided", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagUnits(-100, 50, "realm-1");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({
      score: { lte: -100 },
      realmUnitId: "realm-1",
    });
  });

  test("clamps limit between 1 and 200", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagUnits(0, 5000);
    const args1 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args1.take).toBe(200);

    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagUnits(0, 0);
    const args2 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args2.take).toBe(1);
  });
});

describe("REALM_TAG_VISIBILITY_THRESHOLD", () => {
  test("equals -100 per spec", () => {
    expect(REALM_TAG_VISIBILITY_THRESHOLD).toBe(-100);
  });
});

describe("RealmService.createRealmTagUnit", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("creates RealmTagUnit without creating RealmUnit", async () => {
    await service.createRealmTagUnit("user-1", "realm-1", "unit-1", "tag-1");

    expect(realmTagUnitUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmUnitId_tagUnitId_unitId: {
            realmUnitId: "realm-1",
            tagUnitId: "tag-1",
            unitId: "unit-1",
          },
        },
      }),
    );
    expect(realmUnitCreateMock).not.toHaveBeenCalled();
  });

  test("rejects non-TAG tagUnitId and non-REALM realmUnitId", async () => {
    await expect(
      service.createRealmTagUnit("user-1", "book-1", "unit-1", "tag-1"),
    ).rejects.toThrow("realmUnitId");

    await expect(
      service.createRealmTagUnit("user-1", "realm-1", "unit-1", "book-1"),
    ).rejects.toThrow("tagUnitId");
  });

  test("creates global TagVote and UnitTag aggregate once per user/unit/tag", async () => {
    await service.createRealmTagUnit("user-1", "realm-1", "unit-1", "tag-1");
    tagVoteFindUniqueMock.mockResolvedValueOnce({
      userId: "user-1",
      unitId: "unit-1",
      tagUnitId: "tag-1",
      value: 1,
    });
    realmTagVoteFindUniqueMock.mockResolvedValueOnce({
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      unitId: "unit-1",
      userId: "user-1",
      value: 1,
    });
    await service.createRealmTagUnit("user-1", "realm-1", "unit-1", "tag-1");

    expect(tagVoteCreateMock).toHaveBeenCalledTimes(1);
    expect(unitTagUpsertMock).toHaveBeenCalledTimes(2);
  });

  test("does not amplify global TagVote across multiple realms", async () => {
    await service.createRealmTagUnit("user-1", "realm-1", "unit-1", "tag-1");
    tagVoteFindUniqueMock.mockResolvedValueOnce({
      userId: "user-1",
      unitId: "unit-1",
      tagUnitId: "tag-1",
      value: 1,
    });
    await service.createRealmTagUnit("user-1", "realm-2", "unit-1", "tag-1");

    expect(tagVoteCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe("RealmService.deleteRealmTagUnit", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("deletes only RealmTagUnit and relies on application cascade", async () => {
    await service.deleteRealmTagUnit("realm-1", "unit-1", "tag-1");

    expect(realmTagUnitDeleteMock).toHaveBeenCalledTimes(1);
    expect(realmTagVoteDeleteManyMock).not.toHaveBeenCalled();
    expect(unitTagUpdateMock).not.toHaveBeenCalled();
    expect(unitTagUpsertMock).not.toHaveBeenCalled();
  });
});

describe("RealmService.removeRealmUnit", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("does not delete RealmTagUnit rows when removing feed membership", async () => {
    await service.removeRealmUnit("realm-1", "unit-1");

    expect(realmUnitDeleteMock).toHaveBeenCalledTimes(1);
    expect(realmTagUnitDeleteMock).not.toHaveBeenCalled();
    expect(realmTagVoteDeleteManyMock).not.toHaveBeenCalled();
  });
});
