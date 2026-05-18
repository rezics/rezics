import { beforeEach, describe, expect, mock, test } from "bun:test";
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
  async (_args: unknown): Promise<Array<{ bookUnitId: string }>> => [],
);
const mockContainerUpdateMany = mock(async () => ({ count: 0 }));
const mockFindBookForTarget = mock(async () => ({ type: UnitType.BOOK }));
const mockPostFindUniqueOrThrow = mock(async () => ({
  unitId: "ch-1",
  body: "body",
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
  bookContentStructureNode: {
    updateMany: mockNodeUpdateMany,
    findMany: mockNodeFindMany,
  },
  bookContentStructure: {
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

  test("body-only edit on a single-link chapter bumps exactly one node updatedAt and no container", async () => {
    mockNodeUpdateMany.mockResolvedValue({ count: 1 });
    mockNodeFindMany.mockResolvedValue([]);
    const { chapterService } = await import("./chapter.service");

    await chapterService.update("ch-1", { content: "new body" });

    expect(mockNodeUpdateMany).toHaveBeenCalledTimes(1);
    const args = firstArg(mockNodeUpdateMany);
    expect(args.where).toEqual({ chapterUnitId: "ch-1" });
    expect(args.data.updatedAt).toBeInstanceOf(Date);
    expect(args.data.title).toBeUndefined();
    expect(mockContainerUpdateMany).not.toHaveBeenCalled();
    expect(mockNodeFindMany).not.toHaveBeenCalled();
  });

  test("body edit on a multi-link chapter bumps every linked node via a single updateMany and no container", async () => {
    mockNodeUpdateMany.mockResolvedValue({ count: 3 });
    const { chapterService } = await import("./chapter.service");

    await chapterService.update("ch-1", { content: "edit" });

    expect(mockNodeUpdateMany).toHaveBeenCalledTimes(1);
    expect(firstArg(mockNodeUpdateMany).where).toEqual({
      chapterUnitId: "ch-1",
    });
    expect(mockContainerUpdateMany).not.toHaveBeenCalled();
  });

  test("title rename on a multi-link chapter updates title on every linked node and bumps each affected book's container once", async () => {
    mockNodeFindMany.mockResolvedValue([
      { bookUnitId: "book-1" },
      { bookUnitId: "book-1" },
      { bookUnitId: "book-2" },
    ]);

    const { chapterService } = await import("./chapter.service");

    await chapterService.update("ch-1", { title: "Renamed" });

    expect(mockNodeUpdateMany).toHaveBeenCalledTimes(1);
    const updateArgs = firstArg(mockNodeUpdateMany);
    expect(updateArgs.where).toEqual({ chapterUnitId: "ch-1" });
    expect(updateArgs.data.title).toBe("Renamed");
    expect(updateArgs.data.updatedAt).toBeInstanceOf(Date);

    expect(mockContainerUpdateMany).toHaveBeenCalledTimes(1);
    const containerArgs = firstArg(mockContainerUpdateMany);
    expect(new Set(containerArgs.where.bookUnitId.in)).toEqual(
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
