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
const realmTagApplicationUpsertMock = mock(async ({ create }: any) => ({
  ...create,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}));
const realmTagApplicationUpdateMock = mock(async ({ where, data }: any) => ({
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
const realmTagApplicationDeleteMock = mock(async () => ({}));
const realmTagApplicationVoteFindUniqueMock = mock(
  async (): Promise<any> => null,
);
const realmTagApplicationVoteCreateMock = mock(async () => ({}));
const realmTagApplicationVoteDeleteManyMock = mock(async () => ({ count: 0 }));
const realmTagApplicationVoteAggregateMock = mock(async () => ({
  _sum: { value: 1 },
  _count: { value: 1 },
}));
const tagVoteFindUniqueMock = mock(async (): Promise<any> => null);
const tagVoteCreateMock = mock(async () => ({}));
const tagVoteAggregateMock = mock(async () => ({
  _sum: { value: 1 },
  _count: { value: 1 },
}));
const unitTagUpsertMock = mock(async () => ({}));
const unitTagUpdateMock = mock(async () => ({}));
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const transactionMock = mock(async (fn: any) =>
  fn({
    unit: { findUnique: unitFindUniqueMock },
    unitRealm: {
      create: realmUnitCreateMock,
      delete: realmUnitDeleteMock,
      findMany: realmUnitFindManyMock,
    },
    realmTagApplication: {
      findMany: findManyMock,
      upsert: realmTagApplicationUpsertMock,
      update: realmTagApplicationUpdateMock,
      delete: realmTagApplicationDeleteMock,
    },
    realmTagApplicationVote: {
      findUnique: realmTagApplicationVoteFindUniqueMock,
      create: realmTagApplicationVoteCreateMock,
      deleteMany: realmTagApplicationVoteDeleteManyMock,
      aggregate: realmTagApplicationVoteAggregateMock,
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
  unitRealm: {
    create: realmUnitCreateMock,
    delete: realmUnitDeleteMock,
    findMany: realmUnitFindManyMock,
  },
  realmTagApplication: {
    findMany: findManyMock,
    upsert: realmTagApplicationUpsertMock,
    update: realmTagApplicationUpdateMock,
    delete: realmTagApplicationDeleteMock,
  },
  realmTagApplicationVote: {
    findUnique: realmTagApplicationVoteFindUniqueMock,
    create: realmTagApplicationVoteCreateMock,
    deleteMany: realmTagApplicationVoteDeleteManyMock,
    aggregate: realmTagApplicationVoteAggregateMock,
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
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const { RealmService, REALM_TAG_VISIBILITY_THRESHOLD } = await import(
  "./realm.service"
);

function resetWriteMocks() {
  unitFindUniqueMock.mockClear();
  realmUnitCreateMock.mockClear();
  realmUnitDeleteMock.mockClear();
  realmUnitFindManyMock.mockClear();
  realmTagApplicationUpsertMock.mockClear();
  realmTagApplicationUpdateMock.mockClear();
  realmTagApplicationDeleteMock.mockClear();
  realmTagApplicationVoteFindUniqueMock.mockClear();
  realmTagApplicationVoteFindUniqueMock.mockResolvedValue(null);
  realmTagApplicationVoteCreateMock.mockClear();
  realmTagApplicationVoteDeleteManyMock.mockClear();
  realmTagApplicationVoteAggregateMock.mockClear();
  tagVoteFindUniqueMock.mockClear();
  tagVoteFindUniqueMock.mockResolvedValue(null);
  tagVoteCreateMock.mockClear();
  tagVoteAggregateMock.mockClear();
  unitTagUpsertMock.mockClear();
  unitTagUpdateMock.mockClear();
  enqueueMock.mockClear();
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

describe("RealmService.listLowScoreRealmTagApplications", () => {
  const service = new RealmService();

  test("queries score <= threshold, ordered ascending", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagApplications(-100, 50);
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
    await service.listLowScoreRealmTagApplications(-100, 50, "realm-1");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({
      score: { lte: -100 },
      realmUnitId: "realm-1",
    });
  });

  test("clamps limit between 1 and 200", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagApplications(0, 5000);
    const args1 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args1.take).toBe(200);

    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreRealmTagApplications(0, 0);
    const args2 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args2.take).toBe(1);
  });
});

describe("REALM_TAG_VISIBILITY_THRESHOLD", () => {
  test("equals -100 per spec", () => {
    expect(REALM_TAG_VISIBILITY_THRESHOLD).toBe(-100);
  });
});

describe("RealmService.createRealmTagApplication", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("creates RealmTagApplication without creating UnitRealm", async () => {
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );

    expect(realmTagApplicationUpsertMock).toHaveBeenCalledWith(
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
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchTags",
      "search.content.patchRealmTagKeys",
    ]);
  });

  test("rejects non-TAG tagUnitId and non-REALM realmUnitId", async () => {
    await expect(
      service.createRealmTagApplication("user-1", "book-1", "unit-1", "tag-1"),
    ).rejects.toThrow("realmUnitId");

    await expect(
      service.createRealmTagApplication(
        "user-1",
        "realm-1",
        "unit-1",
        "book-1",
      ),
    ).rejects.toThrow("tagUnitId");
  });

  test("creates global TagVote and UnitTag aggregate once per user/unit/tag", async () => {
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );
    tagVoteFindUniqueMock.mockResolvedValueOnce({
      userId: "user-1",
      unitId: "unit-1",
      tagUnitId: "tag-1",
      value: 1,
    });
    realmTagApplicationVoteFindUniqueMock.mockResolvedValueOnce({
      realmUnitId: "realm-1",
      tagUnitId: "tag-1",
      unitId: "unit-1",
      userId: "user-1",
      value: 1,
    });
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );

    expect(tagVoteCreateMock).toHaveBeenCalledTimes(1);
    expect(unitTagUpsertMock).toHaveBeenCalledTimes(2);
  });

  test("does not amplify global TagVote across multiple realms", async () => {
    await service.createRealmTagApplication(
      "user-1",
      "realm-1",
      "unit-1",
      "tag-1",
    );
    tagVoteFindUniqueMock.mockResolvedValueOnce({
      userId: "user-1",
      unitId: "unit-1",
      tagUnitId: "tag-1",
      value: 1,
    });
    await service.createRealmTagApplication(
      "user-1",
      "realm-2",
      "unit-1",
      "tag-1",
    );

    expect(tagVoteCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe("RealmService.deleteRealmTagApplication", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("deletes only RealmTagApplication and relies on application cascade", async () => {
    await service.deleteRealmTagApplication("realm-1", "unit-1", "tag-1");

    expect(realmTagApplicationDeleteMock).toHaveBeenCalledTimes(1);
    expect(realmTagApplicationVoteDeleteManyMock).not.toHaveBeenCalled();
    expect(unitTagUpdateMock).not.toHaveBeenCalled();
    expect(unitTagUpsertMock).not.toHaveBeenCalled();
  });
});

describe("RealmService.removeUnitRealm", () => {
  const service = new RealmService();

  beforeEach(resetWriteMocks);

  test("does not delete RealmTagApplication rows when removing feed membership", async () => {
    await service.removeUnitRealm("realm-1", "unit-1");

    expect(realmUnitDeleteMock).toHaveBeenCalledTimes(1);
    expect(realmTagApplicationDeleteMock).not.toHaveBeenCalled();
    expect(realmTagApplicationVoteDeleteManyMock).not.toHaveBeenCalled();
  });
});
