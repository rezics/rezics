import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import {
  installPrismaClientMock,
  PostKind,
  prismaMock,
  UnitStatus,
  UnitType,
} from "@/test/prisma-client-mock";

const bookIndexUpdatedAt = new Date("2026-05-06T00:00:00.000Z");
const updatedBookIndexAt = new Date("2026-05-06T00:00:01.000Z");

const mockQueryRaw = mock(async () => undefined);
const mockFindBook = mock(async () => ({
  id: "book-1",
  type: UnitType.BOOK,
  defaultLanguage: "zh-Hant",
}));
const mockCreateUnit = mock(async () => ({ id: "chapter-new" }));
const mockCreatePost = mock(async () => ({ unitId: "chapter-new" }));
const mockFindBookIndex = mock(async () => ({
  bookUnitId: "book-1",
  index: [{ title: "Chapter One", rating: "R_15" }],
  updatedAt: bookIndexUpdatedAt,
}));
const mockUpdateBookIndex = mock(async () => ({
  bookUnitId: "book-1",
  updatedAt: updatedBookIndexAt,
}));
const mockTransaction = mock(async (fn: (tx: unknown) => unknown) =>
  fn({
    $queryRaw: mockQueryRaw,
    unit: {
      findUnique: mockFindBook,
      create: mockCreateUnit,
    },
    post: {
      create: mockCreatePost,
    },
    bookIndex: {
      findUniqueOrThrow: mockFindBookIndex,
      update: mockUpdateBookIndex,
    },
  }),
);

function firstArg(fn: { mock: { calls: unknown[][] } }) {
  return fn.mock.calls[0]?.[0] as any;
}

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: mockTransaction,
});

describe("ChapterService.materializeByBookPath", () => {
  beforeEach(() => {
    mockQueryRaw.mockClear();
    mockFindBook.mockClear();
    mockCreateUnit.mockClear();
    mockCreatePost.mockClear();
    mockFindBookIndex.mockClear();
    mockUpdateBookIndex.mockClear();
    mockTransaction.mockClear();

    mockFindBook.mockResolvedValue({
      id: "book-1",
      type: UnitType.BOOK,
      defaultLanguage: "zh-Hant",
    });
    mockCreateUnit.mockResolvedValue({ id: "chapter-new" });
    mockCreatePost.mockResolvedValue({ unitId: "chapter-new" });
    mockFindBookIndex.mockResolvedValue({
      bookUnitId: "book-1",
      index: [{ title: "Chapter One", rating: "R_15" }],
      updatedAt: bookIndexUpdatedAt,
    });
    mockUpdateBookIndex.mockResolvedValue({
      bookUnitId: "book-1",
      updatedAt: updatedBookIndexAt,
    });
  });

  test("materializes a BookIndex node and seeds title, language, and rating", async () => {
    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeByBookPath(
      "book-1",
      { path: [0], expectedTitle: "Chapter One" },
      "actor-user",
    );

    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockCreateUnit).toHaveBeenCalledWith({
      data: {
        userId: "actor-user",
        type: UnitType.POST,
        status: UnitStatus.PUBLISHED,
        defaultLanguage: "zh-Hant",
        rating: "R_15",
        translations: {
          create: {
            language: "zh-Hant",
            title: "Chapter One",
          },
        },
      },
    });
    expect(mockCreatePost).toHaveBeenCalledWith({
      data: {
        unitId: "chapter-new",
        authorUserId: "actor-user",
        targetUnitId: "book-1",
        kind: PostKind.CHAPTER,
        body: "",
        rootPostUnitId: "chapter-new",
        depth: 0,
      },
    });
    expect(firstArg(mockUpdateBookIndex).data.index).toEqual([
      {
        title: "Chapter One",
        rating: "R_15",
        chapterUnitId: "chapter-new",
      },
    ]);
    expect(result).toEqual({
      bookUnitId: "book-1",
      path: [0],
      chapterUnitId: "chapter-new",
      alreadyMaterialized: false,
      bookIndexUpdatedAt: updatedBookIndexAt,
    });
  });

  test("returns an existing chapterUnitId without creating duplicate rows", async () => {
    mockFindBookIndex.mockResolvedValue({
      bookUnitId: "book-1",
      index: [{ title: "Chapter One", chapterUnitId: "chapter-existing" }],
      updatedAt: bookIndexUpdatedAt,
    });
    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeByBookPath(
      "book-1",
      { path: [0], expectedTitle: "Chapter One" },
      "actor-user",
    );

    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockUpdateBookIndex).not.toHaveBeenCalled();
    expect(result).toEqual({
      bookUnitId: "book-1",
      path: [0],
      chapterUnitId: "chapter-existing",
      alreadyMaterialized: true,
      bookIndexUpdatedAt,
    });
  });

  test("rejects stale paths and stale BookIndex timestamps without creating rows", async () => {
    const { chapterService } = await import("./chapter.service");

    await expect(
      chapterService.materializeByBookPath(
        "book-1",
        { path: [0], expectedTitle: "Old Title" },
        "actor-user",
      ),
    ).rejects.toThrow("Conflict: BookIndex path no longer matches title");

    await expect(
      chapterService.materializeByBookPath(
        "book-1",
        {
          path: [0],
          expectedTitle: "Chapter One",
          expectedBookIndexUpdatedAt: "2026-05-06T01:00:00.000Z",
        },
        "actor-user",
      ),
    ).rejects.toThrow("Conflict: BookIndex has changed");

    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockUpdateBookIndex).not.toHaveBeenCalled();
  });

  test("re-checks the BookIndex after acquiring the row lock", async () => {
    const events: string[] = [];
    mockQueryRaw.mockImplementation(async () => {
      events.push("lock");
    });
    mockFindBookIndex.mockImplementation(async () => {
      events.push("read-index");
      return {
        bookUnitId: "book-1",
        index: [{ title: "Chapter One", chapterUnitId: "chapter-existing" }],
        updatedAt: bookIndexUpdatedAt,
      };
    });
    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeByBookPath(
      "book-1",
      { path: [0], expectedTitle: "Chapter One" },
      "actor-user",
    );

    expect(events).toEqual(["lock", "read-index"]);
    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(result.chapterUnitId).toBe("chapter-existing");
    expect(result.alreadyMaterialized).toBe(true);
  });
});

describe("chapter materialization API permissions", () => {
  test("rejects callers without book update permission", async () => {
    mock.module("@/middleware", () => ({
      authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
        resolve: () => ({
          identity: {
            userId: "actor-user",
            permission: { role: "MEMBER" },
          },
        }),
      }),
      verifyAdminFromDb: async () => false,
    }));
    const mockMaterialize = mock(async () => ({
      bookUnitId: "book-1",
      path: [0],
      chapterUnitId: "chapter-new",
      alreadyMaterialized: false,
      bookIndexUpdatedAt,
    }));
    mock.module("@/unit/unit.service", () => ({
      unitService: {
        getByUnitId: async () => ({
          unitId: "book-1",
          user: { unitId: "other-user" },
        }),
      },
    }));
    mock.module("./chapter.service", () => ({
      chapterService: {
        materializeByBookPath: mockMaterialize,
      },
    }));
    const { chapterApi } = await import("./chapter.api");

    const response = await chapterApi.handle(
      new Request("http://localhost/chapter/materialize/book/book-1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: [0],
          expectedTitle: "Chapter One",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mockMaterialize).not.toHaveBeenCalled();
  });
});
