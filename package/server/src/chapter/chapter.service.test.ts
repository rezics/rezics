import { beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import {
  installPrismaClientMock,
  prismaMock,
  UnitType,
} from "@/test/prisma-client-mock";

installPrismaClientMock();

const mockPostUpdate = mock(async () => ({}));
const mockUnitUpdate = mock(async () => ({}));
const mockUnitFindUnique = mock(async () => ({ defaultLanguage: "en" }));
const mockTranslationFindFirst = mock(
  async (): Promise<{ language: string; extra: unknown } | null> => ({
    language: "en",
    extra: null,
  }),
);
const mockTranslationUpdate = mock(async () => ({}));
const mockTranslationCreate = mock(async () => ({}));
const mockNodeUpdateMany = mock(async () => ({ count: 0 }));
const mockNodeFindMany = mock(
  async (_args: unknown): Promise<Array<{ ownerUnitId: string }>> => [],
);
const mockContainerUpdateMany = mock(async () => ({ count: 0 }));
const mockFindBookForTarget = mock(async () => ({ type: UnitType.BOOK }));
const mockPostFindUniqueOrThrow = mock(async () => ({
  unitId: "ch-1",
  content: markdownContentDoc("body"),
}));

const mockTx = {
  post: {
    update: mockPostUpdate,
    findUniqueOrThrow: mockPostFindUniqueOrThrow,
  },
  unit: {
    update: mockUnitUpdate,
    findUniqueOrThrow: mockUnitFindUnique,
  },
  unitTranslation: {
    findFirst: mockTranslationFindFirst,
    update: mockTranslationUpdate,
    create: mockTranslationCreate,
  },
  contentStructureNode: {
    updateMany: mockNodeUpdateMany,
    findMany: mockNodeFindMany,
  },
  contentStructure: {
    updateMany: mockContainerUpdateMany,
  },
};

const mockTransaction = mock(async (fn: (tx: unknown) => unknown) =>
  fn(mockTx),
);

Object.assign(prismaMock, {
  $transaction: mockTransaction,
  unit: { findUnique: mockFindBookForTarget },
});

// chapter.api.test.ts registers a global mock for "./chapter.service" to test
// unauthorized API rejection. That mock persists across test files in Bun,
// so without intervention this file's `await import("./chapter.service")`
// would return the stub. Re-register a mock here that returns the real
// implementation (loaded via the absolute path which is not aliased).
const REAL_CHAPTER_SERVICE_PATH = new URL(
  "./chapter.service.ts",
  import.meta.url,
).href;
mock.module("./chapter.service", () => import(REAL_CHAPTER_SERVICE_PATH));

function firstArg(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls[0]?.[0] as any;
}

const content = (source: string) => markdownContentDoc(source);

function resetMocks(): void {
  mockPostUpdate.mockClear();
  mockUnitUpdate.mockClear();
  mockUnitFindUnique.mockClear();
  mockTranslationFindFirst.mockClear();
  mockTranslationUpdate.mockClear();
  mockTranslationCreate.mockClear();
  mockNodeUpdateMany.mockClear();
  mockNodeFindMany.mockClear();
  mockContainerUpdateMany.mockClear();
  mockFindBookForTarget.mockClear();
  mockPostFindUniqueOrThrow.mockClear();
  mockTransaction.mockClear();
}

describe("ChapterService.update propagation", () => {
  beforeEach(() => {
    resetMocks();
    mockTranslationFindFirst.mockResolvedValue({ language: "en", extra: null });
  });

  test("content-only edit on a single-link chapter bumps exactly one node updatedAt and no container", async () => {
    mockNodeUpdateMany.mockResolvedValue({ count: 1 });
    mockNodeFindMany.mockResolvedValue([]);
    const { chapterService } = await import("./chapter.service");

    await chapterService.update("ch-1", { content: content("new body") });

    expect(mockNodeUpdateMany).toHaveBeenCalledTimes(1);
    const args = firstArg(mockNodeUpdateMany);
    expect(args.where).toEqual({ contentUnitId: "ch-1" });
    expect(args.data.updatedAt).toBeInstanceOf(Date);
    expect(args.data.title).toBeUndefined();
    expect(mockContainerUpdateMany).not.toHaveBeenCalled();
    expect(mockNodeFindMany).not.toHaveBeenCalled();
  });

  test("content edit on a multi-link chapter bumps every linked node via a single updateMany and no container", async () => {
    mockNodeUpdateMany.mockResolvedValue({ count: 3 });
    const { chapterService } = await import("./chapter.service");

    await chapterService.update("ch-1", { content: content("edit") });

    expect(mockNodeUpdateMany).toHaveBeenCalledTimes(1);
    expect(firstArg(mockNodeUpdateMany).where).toEqual({
      contentUnitId: "ch-1",
    });
    expect(mockContainerUpdateMany).not.toHaveBeenCalled();
  });

  test("title rename on a multi-link chapter updates title on every linked node and bumps each affected book's container once", async () => {
    mockNodeFindMany.mockResolvedValue([
      { ownerUnitId: "book-1" },
      { ownerUnitId: "book-1" },
      { ownerUnitId: "book-2" },
    ]);

    const { chapterService } = await import("./chapter.service");

    await chapterService.update("ch-1", { title: "Renamed" });

    expect(mockNodeUpdateMany).toHaveBeenCalledTimes(1);
    const updateArgs = firstArg(mockNodeUpdateMany);
    expect(updateArgs.where).toEqual({
      contentUnitId: "ch-1",
      isDeleted: false,
    });
    expect(updateArgs.data.title).toBe("Renamed");
    expect(updateArgs.data.updatedAt).toBeInstanceOf(Date);

    expect(mockContainerUpdateMany).toHaveBeenCalledTimes(1);
    const containerArgs = firstArg(mockContainerUpdateMany);
    expect(new Set(containerArgs.where.ownerUnitId.in)).toEqual(
      new Set(["book-1", "book-2"]),
    );
  });

  test("no propagation when neither content nor title change", async () => {
    const { chapterService } = await import("./chapter.service");

    await chapterService.update("ch-1", { status: "DRAFT" });

    expect(mockNodeUpdateMany).not.toHaveBeenCalled();
    expect(mockNodeFindMany).not.toHaveBeenCalled();
    expect(mockContainerUpdateMany).not.toHaveBeenCalled();
  });
});
