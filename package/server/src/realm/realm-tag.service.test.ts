import { describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const findManyMock = mock(() => Promise.resolve([]));

mock.module("#/prisma/client", () => ({
  prisma: {
    realmTagUnit: { findMany: findManyMock },
  },
  UnitStatus: { PUBLISHED: "PUBLISHED" },
  UnitType: { REALM: "REALM" },
}));

mock.module("@/meili/content/sync", () => ({
  patchContentTagsToMeili: async () => undefined,
  patchContentRealmIdsToMeili: async () => undefined,
  patchContentRealmTagKeysToMeili: async () => undefined,
}));

mock.module("@/meili/realm/sync", () => ({
  patchRealmMemberCountToMeili: async () => undefined,
  patchRealmMetadataToMeili: async () => undefined,
  syncRealmToMeili: async () => undefined,
}));

const { RealmService, REALM_TAG_VISIBILITY_THRESHOLD } = await import(
  "./realm.service"
);

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
