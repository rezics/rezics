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
  ownerUnitId: string;
  parentId: string | null;
  sortKey: string;
  contentUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: string | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function nodeRow(
  partial: Partial<FakeNodeRow> &
    Pick<FakeNodeRow, "id" | "parentId" | "sortKey" | "title">,
): FakeNodeRow {
  return {
    ownerUnitId: "book-1",
    contentUnitId: null,
    noContent: false,
    rating: null,
    isDeleted: false,
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
  ownerUnitId: "book-1",
  updatedAt: bookContentStructureUpdatedAt,
}));
const mockFindNode = mock(
  async (_args: unknown): Promise<FakeNodeRow | null> =>
    nodeRow({
      id: "n-1",
      parentId: null,
      sortKey: "g",
      title: "Chapter One",
      rating: "R_15",
    }),
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
    contentStructure: {
      findUniqueOrThrow: mockFindContentStructure,
      update: mockUpdateContentStructure,
    },
    contentStructureNode: {
      findFirst: mockFindNode,
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

describe("ChapterService.materializeNode", () => {
  beforeEach(() => {
    mockQueryRaw.mockClear();
    mockFindBook.mockClear();
    mockCreateUnit.mockClear();
    mockCreatePost.mockClear();
    mockUpdateBook.mockClear();
    mockFindContentStructure.mockClear();
    mockFindNode.mockClear();
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
      ownerUnitId: "book-1",
      updatedAt: bookContentStructureUpdatedAt,
    });
    mockFindNode.mockResolvedValue(
      nodeRow({
        id: "n-1",
        parentId: null,
        sortKey: "g",
        title: "Chapter One",
        rating: "R_15",
      }),
    );
    mockUpdateContentStructure.mockResolvedValue({
      updatedAt: updatedContentStructureAt,
    });
  });

  test("materializes a node row and seeds title, language, and rating", async () => {
    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeNode(
      "book-1",
      { nodeId: "n-1" },
      "actor-user",
    );

    expect(mockQueryRaw).toHaveBeenCalled();
    expect(firstArg(mockFindNode)).toEqual({
      where: { id: "n-1", ownerUnitId: "book-1", isDeleted: false },
    });
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
      data: { contentUnitId: "chapter-new" },
    });
    expect(mockUpdateBook).not.toHaveBeenCalled();
    expect(result).toEqual({
      bookUnitId: "book-1",
      nodeId: "n-1",
      contentUnitId: "chapter-new",
      chapterUnitId: "chapter-new",
      alreadyMaterialized: false,
      bookContentStructureUpdatedAt: updatedContentStructureAt,
    });
  });

  test("returns an existing chapterUnitId without creating duplicate rows", async () => {
    mockFindNode.mockResolvedValue(
      nodeRow({
        id: "n-1",
        parentId: null,
        sortKey: "g",
        title: "Chapter One",
        contentUnitId: "chapter-existing",
      }),
    );

    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeNode(
      "book-1",
      { nodeId: "n-1" },
      "actor-user",
    );

    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockUpdateContentStructure).not.toHaveBeenCalled();
    expect(result).toEqual({
      bookUnitId: "book-1",
      nodeId: "n-1",
      contentUnitId: "chapter-existing",
      chapterUnitId: "chapter-existing",
      alreadyMaterialized: true,
      bookContentStructureUpdatedAt,
    });
  });

  test("rejects a missing or deleted node without creating rows", async () => {
    mockFindNode.mockResolvedValue(null);
    const { chapterService } = await import("./chapter.service");

    await expect(
      chapterService.materializeNode("book-1", { nodeId: "n-1" }, "actor-user"),
    ).rejects.toThrow("NotFound: ContentStructureNode n-1");

    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(mockCreatePost).not.toHaveBeenCalled();
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockUpdateContentStructure).not.toHaveBeenCalled();
  });

  test("concurrent materialization is idempotent: re-reads after lock and sees existing contentUnitId", async () => {
    const events: string[] = [];
    mockQueryRaw.mockImplementation(async () => {
      events.push("lock");
    });
    mockFindNode.mockImplementation(async () => {
      events.push("read-node");
      return nodeRow({
        id: "n-1",
        parentId: null,
        sortKey: "g",
        title: "Chapter One",
        contentUnitId: "chapter-existing",
      });
    });
    const { chapterService } = await import("./chapter.service");

    const result = await chapterService.materializeNode(
      "book-1",
      { nodeId: "n-1" },
      "actor-user",
    );

    expect(events).toEqual(["lock", "read-node"]);
    expect(mockCreateUnit).not.toHaveBeenCalled();
    expect(result.contentUnitId).toBe("chapter-existing");
    expect(result.chapterUnitId).toBe("chapter-existing");
    expect(result.alreadyMaterialized).toBe(true);
  });
});
