import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const { TagService, VISIBILITY_THRESHOLD } = await import("./tag.service");

const listTags = mock(async () => ({ tags: [], total: 0 }));
const getTag = mock(async () => ({ id: "tag-1", translations: [] }));
const createTag = mock(async () => ({ id: "tag-1", translations: [] }));
const updateTranslations = mock(async () => undefined);
const deleteTag = mock(async () => undefined);
const createUnitTag = mock(async () => ({
  unitId: "unit-1",
  tagUnitId: "tag-1",
  score: 1,
  voteCount: 1,
}));
const setUnitTagPin = mock(async () => ({
  unitId: "unit-1",
  tagUnitId: "tag-1",
  score: 1,
  voteCount: 1,
}));
const deleteUnitTag = mock(async () => undefined);
const castVote = mock(async () => undefined);
const getTagsForUnit = mock(async () => []);
const listLowScoreUnitTags = mock(async () => []);
const batchTranslations = mock(async () => ({}));

const repository = {
  listTags,
  getTag,
  createTag,
  updateTranslations,
  deleteTag,
  createUnitTag,
  setUnitTagPin,
  deleteUnitTag,
  castVote,
  getTagsForUnit,
  listLowScoreUnitTags,
  batchTranslations,
};

describe("TagService.getTagsForUnit", () => {
  const service = new TagService(repository as any);

  beforeEach(() => {
    getTagsForUnit.mockClear();
    getTagsForUnit.mockResolvedValue([]);
  });

  test("regular caller delegates without below-threshold access", async () => {
    await service.getTagsForUnit("unit-x");

    expect(getTagsForUnit).toHaveBeenCalledWith("unit-x", undefined);
  });

  test("privileged caller delegates with below-threshold access", async () => {
    await service.getTagsForUnit("unit-x", { includeBelowThreshold: true });

    expect(getTagsForUnit).toHaveBeenCalledWith("unit-x", {
      includeBelowThreshold: true,
    });
  });
});

describe("TagService.listLowScoreUnitTags", () => {
  const service = new TagService(repository as any);

  beforeEach(() => {
    listLowScoreUnitTags.mockClear();
    listLowScoreUnitTags.mockResolvedValue([]);
  });

  test("delegates threshold and limit", async () => {
    await service.listLowScoreUnitTags(-100, 50);

    expect(listLowScoreUnitTags).toHaveBeenCalledWith(-100, 50);
  });
});

describe("TagService tag writes", () => {
  const service = new TagService(repository as any);

  beforeEach(() => {
    enqueueMock.mockClear();
    castVote.mockClear();
    castVote.mockResolvedValue(undefined);
  });

  test("castVote enqueues content tag projection", async () => {
    await service.castVote("user-1", "unit-1", "tag-1", 1);

    expect(castVote).toHaveBeenCalledWith("user-1", "unit-1", "tag-1", 1);
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
