import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

const mockSyncContentToMeili = mock(async (_unitId: string) => undefined);
const mockPatchContentMetadataToMeili = mock(
  async (_unitId: string, _patch: Record<string, unknown>) => undefined,
);

mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: async () => undefined,
  patchContentMetadataToMeili: mockPatchContentMetadataToMeili,
  syncContentToMeili: mockSyncContentToMeili,
}));

interface FakeRow {
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

function makeRow(
  partial: Partial<FakeRow> &
    Pick<FakeRow, "id" | "parentId" | "sortKey" | "title">,
): FakeRow {
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

const mockFindNodeRows = mock(
  async (..._args: unknown[]): Promise<FakeRow[]> => [],
);
const mockCreateNode = mock(async (_args: unknown) => ({ id: "" }));
const mockUpdateNode = mock(async (_args: unknown) => ({ id: "" }));
const mockDeleteManyNode = mock(async (_args: unknown) => ({ count: 0 }));
const mockUpdateBook = mock(async (_args: unknown) => ({ unitId: "book-1" }));
const mockCreateBook = mock(async (_args: unknown) => ({
  unitId: "book-1",
  unit: {
    id: "book-1",
    userId: undefined,
    workUnitId: null,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    rating: "GENERAL",
    defaultLanguage: "en",
    isLanguageNeutral: false,
    translations: [],
    creditAttributions: [],
    publishedAt: null,
  },
  isbn13: null,
  publicationDate: null,
  pageCount: null,
  textLength: 0,
  chapterCount: 0,
  formatKey: null,
  isLicensed: false,
  extra: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}));
const mockUpdateContainer = mock(async (_args: unknown) => ({
  bookUnitId: "book-1",
  createdAt: new Date(),
  updatedAt: new Date(),
}));
const mockFindContainer = mock(async (_args: unknown) => ({
  bookUnitId: "book-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}));

const mockTx = {
  bookContentStructureNode: {
    findMany: mockFindNodeRows,
    create: mockCreateNode,
    update: mockUpdateNode,
    deleteMany: mockDeleteManyNode,
  },
  bookContentStructure: {
    update: mockUpdateContainer,
  },
  book: {
    update: mockUpdateBook,
  },
};

const mockTransaction = mock(async (fn: (tx: unknown) => unknown) =>
  fn(mockTx),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: mockTransaction,
  bookContentStructure: {
    findUniqueOrThrow: mockFindContainer,
  },
  bookContentStructureNode: {
    findMany: mockFindNodeRows,
  },
  book: {
    create: mockCreateBook,
  },
});

function resetMocks(): void {
  mockFindNodeRows.mockClear();
  mockCreateNode.mockClear();
  mockUpdateNode.mockClear();
  mockDeleteManyNode.mockClear();
  mockUpdateBook.mockClear();
  mockCreateBook.mockClear();
  mockUpdateContainer.mockClear();
  mockFindContainer.mockClear();
  mockTransaction.mockClear();
  mockSyncContentToMeili.mockClear();
  mockPatchContentMetadataToMeili.mockClear();
}

describe("BookService.create", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("new books start with chapterCount 0", async () => {
    const { bookService } = await import("./book.service");

    await bookService.create({
      userId: "user-1",
      defaultLanguage: "en",
      translations: [{ language: "en", title: "Book" }],
    });

    const createArgs = mockCreateBook.mock.calls[0]?.[0] as any;
    expect(createArgs.data.chapterCount).toBe(0);
    expect(mockSyncContentToMeili).toHaveBeenCalledWith("book-1");
  });
});

describe("BookService.updateContentStructure (diff-based)", () => {
  beforeEach(() => {
    resetMocks();
    mockFindContainer.mockResolvedValue({
      bookUnitId: "book-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  test("no-op save against unchanged tree issues zero row mutations", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-a", parentId: null, sortKey: "g", title: "A" }),
      makeRow({ id: "n-b", parentId: null, sortKey: "n", title: "B" }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-a", title: "A" },
      { id: "n-b", title: "B" },
    ]);

    expect(mockCreateNode).not.toHaveBeenCalled();
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockDeleteManyNode).not.toHaveBeenCalled();
    expect(mockUpdateContainer).not.toHaveBeenCalled();
    expect(mockUpdateBook).not.toHaveBeenCalled();
  });

  test("single rename issues exactly one UPDATE and bumps container once", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-a", parentId: null, sortKey: "g", title: "Old" }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-a", title: "New" },
    ]);

    expect(mockUpdateNode).toHaveBeenCalledTimes(1);
    expect(mockCreateNode).not.toHaveBeenCalled();
    expect(mockDeleteManyNode).not.toHaveBeenCalled();
    expect(mockUpdateContainer).toHaveBeenCalledTimes(1);
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 1 },
    });
  });

  test("delete subtree issues a single deleteMany covering all omitted ids", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-root", parentId: null, sortKey: "g", title: "Root" }),
      makeRow({
        id: "n-child-1",
        parentId: "n-root",
        sortKey: "g",
        title: "C1",
      }),
      makeRow({
        id: "n-child-2",
        parentId: "n-root",
        sortKey: "n",
        title: "C2",
      }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-root", title: "Root" },
    ]);

    expect(mockDeleteManyNode).toHaveBeenCalledTimes(1);
    const deleteArgs = mockDeleteManyNode.mock.calls[0]?.[0] as any;
    expect(new Set(deleteArgs.where.id.in)).toEqual(
      new Set(["n-child-1", "n-child-2"]),
    );
    expect(mockUpdateContainer).toHaveBeenCalledTimes(1);
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 1 },
    });
  });

  test("insert new sibling produces one INSERT with sortKey between neighbors", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-a", parentId: null, sortKey: "g", title: "A" }),
      makeRow({ id: "n-c", parentId: null, sortKey: "n", title: "C" }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-a", title: "A" },
      { title: "B (new)" },
      { id: "n-c", title: "C" },
    ]);

    expect(mockCreateNode).toHaveBeenCalledTimes(1);
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockDeleteManyNode).not.toHaveBeenCalled();
    const createArgs = mockCreateNode.mock.calls[0]?.[0] as any;
    expect(createArgs.data.title).toBe("B (new)");
    expect(createArgs.data.sortKey > "g").toBe(true);
    expect(createArgs.data.sortKey < "n").toBe(true);
    expect(mockUpdateContainer).toHaveBeenCalledTimes(1);
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 3 },
    });
  });

  test("noContent toggles recompute readable chapter count", async () => {
    const existing: FakeRow[] = [
      makeRow({
        id: "n-a",
        parentId: null,
        sortKey: "g",
        title: "A",
        noContent: true,
      }),
      makeRow({ id: "n-b", parentId: null, sortKey: "n", title: "B" }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-a", title: "A" },
      { id: "n-b", title: "B", noContent: true },
    ]);

    expect(mockUpdateNode).toHaveBeenCalledTimes(2);
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 1 },
    });
  });

  test("submitting two nodes with the same chapterUnitId creates both rows", async () => {
    const existing: FakeRow[] = [
      makeRow({
        id: "n-existing",
        parentId: null,
        sortKey: "g",
        chapterUnitId: "ch-1",
        title: "Preface",
      }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-existing", title: "Preface", chapterUnitId: "ch-1" },
      { title: "Preface (in appendix)", chapterUnitId: "ch-1" },
    ]);

    expect(mockCreateNode).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateNode.mock.calls[0]?.[0] as any;
    expect(createArgs.data.chapterUnitId).toBe("ch-1");
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 2 },
    });
  });
});
