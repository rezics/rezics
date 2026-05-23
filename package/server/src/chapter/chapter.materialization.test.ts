import { beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import {
  installPrismaClientMock,
  PostKind,
  prismaMock,
  UnitStatus,
  UnitType,
} from "@/test/prisma-client-mock";

const bookContentStructureUpdatedAt = new Date("2026-05-06T00:00:00.000Z");
const updatedContentStructureAt = new Date("2026-05-06T00:00:01.000Z");

interface FakeNodeRow {
  id: string;
  bookUnitId: string;
  parentId: string | null;
  sortKey: string;
  chapterUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function nodeRow(
  partial: Partial<FakeNodeRow> &
    Pick<FakeNodeRow, "id" | "parentId" | "sortKey" | "title">,
): FakeNodeRow {
  return {
    bookUnitId: "book-1",
    chapterUnitId: null,
    noContent: false,
    rating: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...partial,
  };
}

const mockQueryRaw = mock(async () => undefined);
const mockFindBook = mock(async () => ({
  id: "book-1",
  type: UnitType.BOOK,
  defaultLanguage: "zh-Hant",
}));
const mockCreateUnit = mock(async () => ({ id: "chapter-new" }));
const mockCreatePost = mock(async () => ({ unitId: "chapter-new" }));
const mockUpdateBook = mock(async (_args: unknown) => ({ unitId: "book-1" }));
const mockFindContentStructure = mock(async () => ({
  bookUnitId: "book-1",
  updatedAt: bookContentStructureUpdatedAt,
}));
const mockFindNodeRows = mock(
  async (_args: unknown): Promise<FakeNodeRow[]> => [
    nodeRow({
      id: "n-1",
      parentId: null,
      sortKey: "g",
      title: "Chapter One",
      rating: "R_15",
    }),
  ],
);
const mockUpdateNode = mock(async () => ({}));
const mockUpdateContentStructure = mock(async () => ({
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
    book: {
      update: mockUpdateBook,
    },
    bookContentStructure: {
      findUniqueOrThrow: mockFindContentStructure,
      update: mockUpdateContentStructure,
    },
    bookContentStructureNode: {
      findMany: mockFindNodeRows,
      update: mockUpdateNode,
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
    mockUpdateBook.mockClear();
    mockFindContentStructure.mockClear();
    mockFindNodeRows.mockClear();
    mockUpdateNode.mockClear();
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
      updatedAt: bookContentStructureUpdatedAt,
    });
    mockFindNodeRows.mockResolvedValue([
      nodeRow({
        id: "n-1",
        parentId: null,
        sortKey: "g",
        title: "Chapter One",
        rating: "R_15",
      }),
    ]);
    mockUpdateContentStructure.mockResolvedValue({
      updatedAt: updatedContentStructureAt,
    });
  });

  test("materializes a node row and seeds title, language, and rating", async () => {
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
        slugScope: "actor-user",
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
        content: markdownContentDoc(""),
        rootPostUnitId: "chapter-new",
        depth: 0,
      },
    });
    expect(firstArg(mockUpdateNode)).toEqual({
      where: { id: "n-1" },
      data: { chapterUnitId: "chapter-new" },
    });
    expect(mockUpdateBook).not.toHaveBeenCalled();
    expect(result).toEqual({
      bookUnitId: "book-1",
      path: [0],
      chapterUnitId: "chapter-new",
      alreadyMaterialized: false,
      bookContentStructureUpdatedAt: updatedContentStructureAt,
    });
  });

  test("returns an existing chapterUnitId without creating duplicate rows", async () => {
    mockFindNodeRows.mockResolvedValue([
      nodeRow({
        id: "n-1",
        parentId: null,
        sortKey: "g",
        title: "Chapter One",
        chapterUnitId: "chapter-existing",
      }),
    ]);

    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeByBookPath(
      "book-1",
      { path: [0], expectedTitle: "Chapter One" },
      "actor-user",
    );

    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockUpdateContentStructure).not.toHaveBeenCalled();
    expect(result).toEqual({
      bookUnitId: "book-1",
      path: [0],
      chapterUnitId: "chapter-existing",
      alreadyMaterialized: true,
      bookContentStructureUpdatedAt,
    });
  });

  test("rejects stale paths (title mismatch) without creating rows", async () => {
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

    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockUpdateContentStructure).not.toHaveBeenCalled();
  });

  test("rejects stale paths (updatedAt mismatch) without creating rows", async () => {
    const { chapterService } = await import("./chapter.service");

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
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockUpdateContentStructure).not.toHaveBeenCalled();
  });

  test("rejects stale path that no longer resolves to any row", async () => {
    mockFindNodeRows.mockResolvedValue([]);
    const { chapterService } = await import("./chapter.service");

    await expect(
      chapterService.materializeByBookPath(
        "book-1",
        { path: [0], expectedTitle: "Chapter One" },
        "actor-user",
      ),
    ).rejects.toThrow("Conflict: BookContentStructure path does not resolve");

    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockUpdateNode).not.toHaveBeenCalled();
  });

  test("concurrent materialization is idempotent: re-reads after lock and sees existing chapterUnitId", async () => {
    const events: string[] = [];
    mockQueryRaw.mockImplementation(async () => {
      events.push("lock");
    });
    mockFindNodeRows.mockImplementation(async () => {
      events.push("read-rows");
      return [
        nodeRow({
          id: "n-1",
          parentId: null,
          sortKey: "g",
          title: "Chapter One",
          chapterUnitId: "chapter-existing",
        }),
      ];
    });
    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeByBookPath(
      "book-1",
      { path: [0], expectedTitle: "Chapter One" },
      "actor-user",
    );

    expect(events).toEqual(["lock", "read-rows"]);
    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(result.chapterUnitId).toBe("chapter-existing");
    expect(result.alreadyMaterialized).toBe(true);
  });
});
