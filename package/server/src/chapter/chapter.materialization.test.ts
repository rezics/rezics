import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import {
  installPrismaClientMock,
  PostKind,
  prismaMock,
  UnitStatus,
  UnitType,
} from "@/test/prisma-client-mock";

const bookContentStructureUpdatedAt = new Date("2026-05-06T00:00:00.000Z");
const updatedContentStructureAt = new Date("2026-05-06T00:00:01.000Z");

const mockQueryRaw = mock(async () => undefined);
const mockFindBook = mock(async () => ({
  id: "book-1",
  type: UnitType.BOOK,
  defaultLanguage: "zh-Hant",
}));
const mockCreateUnit = mock(async () => ({ id: "chapter-new" }));
const mockCreatePost = mock(async () => ({ unitId: "chapter-new" }));
const mockFindContentStructure = mock(async () => ({
  bookUnitId: "book-1",
  nodes: [{ title: "Chapter One", rating: "R_15" }],
  updatedAt: bookContentStructureUpdatedAt,
}));
const mockUpdateContentStructure = mock(async () => ({
  bookUnitId: "book-1",
  updatedAt: updatedContentStructureAt,
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
    bookContentStructure: {
      findUniqueOrThrow: mockFindContentStructure,
      update: mockUpdateContentStructure,
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
    mockFindContentStructure.mockClear();
    mockUpdateContentStructure.mockClear();
    mockTransaction.mockClear();

    mockFindBook.mockResolvedValue({
      id: "book-1",
      type: UnitType.BOOK,
      defaultLanguage: "zh-Hant",
    });
    mockCreateUnit.mockResolvedValue({ id: "chapter-new" });
    mockCreatePost.mockResolvedValue({ unitId: "chapter-new" });
    mockFindContentStructure.mockResolvedValue({
      bookUnitId: "book-1",
      nodes: [{ title: "Chapter One", rating: "R_15" }],
      updatedAt: bookContentStructureUpdatedAt,
    });
    mockUpdateContentStructure.mockResolvedValue({
      bookUnitId: "book-1",
      updatedAt: updatedContentStructureAt,
    });
  });

  test("materializes a BookContentStructure node and seeds title, language, and rating", async () => {
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
    expect(firstArg(mockUpdateContentStructure).data.nodes).toEqual([
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
      bookContentStructureUpdatedAt: updatedContentStructureAt,
    });
  });

  test("returns an existing chapterUnitId without creating duplicate rows", async () => {
    mockFindContentStructure.mockResolvedValue({
      bookUnitId: "book-1",
      nodes: [{ title: "Chapter One", chapterUnitId: "chapter-existing" }],
      updatedAt: bookContentStructureUpdatedAt,
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
    expect(mockUpdateContentStructure).not.toHaveBeenCalled();
    expect(result).toEqual({
      bookUnitId: "book-1",
      path: [0],
      chapterUnitId: "chapter-existing",
      alreadyMaterialized: true,
      bookContentStructureUpdatedAt,
    });
  });

  test("rejects stale paths and stale BookContentStructure timestamps without creating rows", async () => {
    const { chapterService } = await import("./chapter.service");

    await expect(
      chapterService.materializeByBookPath(
        "book-1",
        { path: [0], expectedTitle: "Old Title" },
        "actor-user",
      ),
    ).rejects.toThrow(
      "Conflict: BookContentStructure path no longer matches title",
    );

    await expect(
      chapterService.materializeByBookPath(
        "book-1",
        {
          path: [0],
          expectedTitle: "Chapter One",
          expectedBookContentStructureUpdatedAt: "2026-05-06T01:00:00.000Z",
        },
        "actor-user",
      ),
    ).rejects.toThrow("Conflict: BookContentStructure has changed");

    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockUpdateContentStructure).not.toHaveBeenCalled();
  });

  test("re-checks the BookContentStructure after acquiring the row lock", async () => {
    const events: string[] = [];
    mockQueryRaw.mockImplementation(async () => {
      events.push("lock");
    });
    mockFindContentStructure.mockImplementation(async () => {
      events.push("read-index");
      return {
        bookUnitId: "book-1",
        nodes: [{ title: "Chapter One", chapterUnitId: "chapter-existing" }],
        updatedAt: bookContentStructureUpdatedAt,
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
      bookContentStructureUpdatedAt,
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
