import { describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const findManyMock = mock(() => Promise.resolve([]));
mock.module("#/prisma/client", () => ({
  prisma: {
    unitTag: { findMany: findManyMock },
  },
  UnitStatus: { PUBLISHED: "PUBLISHED" },
  UnitType: { TAG: "TAG" },
}));

mock.module("@/meili/content/sync", () => ({
  patchContentTagsToMeili: async () => undefined,
  patchContentRealmIdsToMeili: async () => undefined,
  patchContentRealmTagKeysToMeili: async () => undefined,
}));

const { TagService, VISIBILITY_THRESHOLD } = await import("./tag.service");

describe("TagService.getTagsForUnit", () => {
  const service = new TagService();

  test("regular caller filters out score <= VISIBILITY_THRESHOLD", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.getTagsForUnit("unit-x");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({
      unitId: "unit-x",
      score: { gt: VISIBILITY_THRESHOLD },
    });
  });

  test("privileged caller sees below-threshold rows", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.getTagsForUnit("unit-x", { includeBelowThreshold: true });
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({ unitId: "unit-x" });
  });

  test("orders pin-first then position asc then score desc then tagUnitId asc", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.getTagsForUnit("unit-x");
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.orderBy).toEqual([
      { pinned: "desc" },
      { position: "asc" },
      { score: "desc" },
      { tagUnitId: "asc" },
    ]);
  });
});

describe("TagService.listLowScoreUnitTags", () => {
  const service = new TagService();

  test("queries score <= threshold, ordered ascending", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreUnitTags(-100, 50);
    const args = findManyMock.mock.calls[0]?.[0] as any;
    expect(args.where).toEqual({ score: { lte: -100 } });
    expect(args.orderBy).toEqual([
      { score: "asc" },
      { unitId: "asc" },
      { tagUnitId: "asc" },
    ]);
    expect(args.take).toBe(50);
  });

  test("clamps limit between 1 and 200", async () => {
    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreUnitTags(0, 5000);
    const args1 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args1.take).toBe(200);

    findManyMock.mockClear();
    findManyMock.mockResolvedValueOnce([]);
    await service.listLowScoreUnitTags(0, 0);
    const args2 = findManyMock.mock.calls[0]?.[0] as any;
    expect(args2.take).toBe(1);
  });
});

describe("VISIBILITY_THRESHOLD", () => {
  test("equals -100 per spec", () => {
    expect(VISIBILITY_THRESHOLD).toBe(-100);
  });
});
