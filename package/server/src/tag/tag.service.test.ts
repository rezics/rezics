import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const findManyMock = mock((_args?: unknown) =>
  Promise.resolve([] as unknown[]),
);
const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
installPrismaClientMock();
Object.assign(prismaMock, {
  unitTag: { findMany: findManyMock },
});

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
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

describe("TagService tag writes", () => {
  const service = new TagService();

  test("castVote enqueues content tag projection", async () => {
    enqueueMock.mockClear();
    prismaMock.$transaction = mock(async (fn: any) => fn(prismaMock));
    prismaMock.tagVote = {
      upsert: mock(async () => ({})),
      aggregate: mock(async () => ({
        _sum: { value: 1 },
        _count: { value: 2 },
      })),
    };
    prismaMock.unitTag = {
      ...prismaMock.unitTag,
      update: mock(async () => ({})),
    };

    await service.castVote("user-1", "unit-1", "tag-1", 1);

    expect(enqueueMock.mock.calls.map((call) => call[0])).toMatchObject([
      {
        kind: "search.content.patchTags",
        payload: { unitId: "unit-1" },
        source: { type: "server", service: "tag" },
      },
    ]);
  });
});

describe("VISIBILITY_THRESHOLD", () => {
  // -100 is the score at or below which UnitTag rows are suppressed from regular callers.
  test("equals -100", () => {
    expect(VISIBILITY_THRESHOLD).toBe(-100);
  });
});
