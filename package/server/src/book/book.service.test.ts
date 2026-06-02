import { beforeEach, describe, expect, mock, test } from "bun:test";
import { collectEditorialPatchLeafPaths } from "@rezics/contract";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";
import { mapActualTranslationPatchPaths } from "@/unit/collaborative-metadata";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/infra/infra-users", () => ({
  resolveRezicsWikiUserId: async () => "rezics-wiki-user",
}));

interface FakeRow {
  id: string;
  ownerUnitId: string;
  parentId: string | null;
  position: string;
  contentUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeRow(
  partial: Partial<FakeRow> &
    Pick<FakeRow, "id" | "parentId" | "position" | "title">,
): FakeRow {
  return {
    ownerUnitId: "book-1",
    contentUnitId: null,
    noContent: false,
    rating: null,
    isDeleted: false,
    deletedAt: null,
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
const mockUpdateManyNode = mock(async (_args: unknown) => ({ count: 0 }));
const mockDeleteManyAnchors = mock(async (_args: unknown) => ({ count: 0 }));
const mockCreateManyAnchors = mock(async (_args: unknown) => ({ count: 0 }));
const mockUpdateBook = mock(async (_args: unknown) => ({ unitId: "book-1" }));
const mockFindUniqueBookForUpdate = mock(async (_args: unknown) => ({
  isbn13: null,
  publicationDate: null,
  pageCount: null,
  textLength: 0,
  formatKey: null,
  isLicensed: false,
  extra: null,
  unit: {
    defaultLanguage: "en",
    rating: "GENERAL",
    aiDisclosureMode: "UNKNOWN",
    aiDisclosureDetails: null,
    visibility: "PUBLIC",
    licenseSlug: null,
  },
}));
const mockAllocateSequence = mock(async (_strings: TemplateStringsArray) => [
  { sequence: 1n },
]);
const mockCreateHistoryOutbox = mock(async (_args: unknown) => ({}));
const mockCreateBook = mock(async (_args: unknown) => ({
  unitId: "book-1",
  unit: {
    id: "book-1",
    userId: undefined,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    rating: "GENERAL",
    aiDisclosureMode: "UNKNOWN",
    aiDisclosureDetails: null,
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
const mockUpdateUnit = mock(async (_args: unknown) => ({ id: "unit-1" }));
const mockFindManyBook = mock(async (_args: unknown) => []);
const mockCountBook = mock(async (_args: unknown) => 0);
const mockUpdateContainer = mock(async (_args: unknown) => ({
  ownerUnitId: "book-1",
  createdAt: new Date(),
  updatedAt: new Date(),
}));
const mockFindContainer = mock(async (_args: unknown) => ({
  ownerUnitId: "book-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}));

const mockTx = {
  $queryRaw: mockAllocateSequence,
  contentStructureNode: {
    findMany: mockFindNodeRows,
    create: mockCreateNode,
    update: mockUpdateNode,
    updateMany: mockUpdateManyNode,
    deleteMany: mockDeleteManyNode,
  },
  contentStructureAnchor: {
    deleteMany: mockDeleteManyAnchors,
    createMany: mockCreateManyAnchors,
  },
  contentStructure: {
    upsert: mock(async () => ({})),
    update: mockUpdateContainer,
  },
  book: {
    create: mockCreateBook,
    update: mockUpdateBook,
    findUniqueOrThrow: mockFindUniqueBookForUpdate,
  },
  unit: {
    update: mockUpdateUnit,
  },
  historyOutbox: {
    create: mockCreateHistoryOutbox,
  },
};

const mockTransaction = mock(async (fn: (tx: unknown) => unknown) =>
  fn(mockTx),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: mockTransaction,
  contentStructure: {
    findUniqueOrThrow: mockFindContainer,
  },
  contentStructureNode: {
    findMany: mockFindNodeRows,
  },
  book: {
    create: mockCreateBook,
    findMany: mockFindManyBook,
    count: mockCountBook,
  },
});

function resetMocks(): void {
  mockFindNodeRows.mockClear();
  mockCreateNode.mockClear();
  mockUpdateNode.mockClear();
  mockDeleteManyNode.mockClear();
  mockUpdateManyNode.mockClear();
  mockDeleteManyAnchors.mockClear();
  mockCreateManyAnchors.mockClear();
  mockUpdateBook.mockClear();
  mockFindUniqueBookForUpdate.mockClear();
  mockAllocateSequence.mockClear();
  mockCreateHistoryOutbox.mockClear();
  mockCreateBook.mockClear();
  mockUpdateUnit.mockClear();
  mockFindManyBook.mockClear();
  mockCountBook.mockClear();
  mockUpdateContainer.mockClear();
  mockFindContainer.mockClear();
  mockTransaction.mockClear();
  enqueueMock.mockClear();
}

function latestStructureHistoryOperations(): any[] {
  const createArgs = mockCreateHistoryOutbox.mock.calls.at(-1)?.[0] as any;
  return createArgs.data.payload.event.payload.operations;
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
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.sync",
      payload: { unitId: "book-1" },
      source: { type: "server", service: "book" },
    });
  });

  test("new books default AI disclosure to Prisma UNKNOWN when omitted", async () => {
    const { bookService } = await import("./book.service");

    await bookService.create({
      userId: "user-1",
      defaultLanguage: "en",
      translations: [{ language: "en", title: "Book" }],
    });

    const createArgs = mockCreateBook.mock.calls[0]?.[0] as any;
    expect(createArgs.data.unit.create.aiDisclosureMode).toBeUndefined();
    expect(createArgs.data.unit.create.aiDisclosureDetails).toBeUndefined();
  });

  test("persists explicit AI disclosure without changing rating", async () => {
    const { bookService } = await import("./book.service");

    await bookService.create({
      userId: "user-1",
      defaultLanguage: "en",
      rating: "GENERAL",
      aiDisclosureMode: "AI_ORIGINATED",
      aiDisclosureDetails: { provider: "OpenAI", reviewedByHuman: true },
      translations: [{ language: "en", title: "Book" }],
    });

    const createArgs = mockCreateBook.mock.calls[0]?.[0] as any;
    expect(createArgs.data.unit.create.rating).toBe("GENERAL");
    expect(createArgs.data.unit.create.aiDisclosureMode).toBe("AI_ORIGINATED");
    expect(createArgs.data.unit.create.aiDisclosureDetails).toEqual({
      provider: "OpenAI",
      reviewedByHuman: true,
    });
  });

  test("wiki creation stamps rezics-wiki as owner and does not add whole-object lock", async () => {
    const { bookService } = await import("./book.service");

    await bookService.create({
      userId: "user-1",
      creationMode: "wiki",
      defaultLanguage: "en",
      translations: [{ language: "en", title: "Catalog Book" }],
    });

    const createArgs = mockCreateBook.mock.calls[0]?.[0] as any;
    expect(createArgs.data.unit.create.userId).toBe("rezics-wiki-user");
    expect(createArgs.data.unit.create.slugScope).toBe("rezics-wiki-user");
    expect(createArgs.data.unit.create.fieldLocks).toBeUndefined();
  });

  test("personal creation keeps current user owner and creates whole-object lock", async () => {
    const { bookService } = await import("./book.service");

    await bookService.create({
      userId: "user-1",
      creationMode: "personal",
      defaultLanguage: "en",
      translations: [{ language: "en", title: "Personal Book" }],
    });

    const createArgs = mockCreateBook.mock.calls[0]?.[0] as any;
    expect(createArgs.data.unit.create.userId).toBe("user-1");
    expect(createArgs.data.unit.create.fieldLocks.create).toMatchObject({
      path: "*",
      lockedById: "user-1",
    });
  });

  test("wiki creation writes initial history with creator as actor", async () => {
    const { bookService } = await import("./book.service");

    await bookService.create({
      userId: "user-1",
      creationMode: "wiki",
      defaultLanguage: "en",
      translations: [{ language: "en", title: "Catalog Book" }],
    });

    const createArgs = mockCreateHistoryOutbox.mock.calls[0]?.[0] as any;
    expect(mockCreateHistoryOutbox).toHaveBeenCalledTimes(1);
    expect(createArgs.data.unitId).toBe("book-1");
    expect(createArgs.data.actorUserId).toBe("user-1");
    expect(createArgs.data.payload.revision.patch).toEqual({
      translations: { en: { title: "Catalog Book" } },
    });
  });

  test("personal creation writes initial history with creator as actor", async () => {
    const { bookService } = await import("./book.service");

    await bookService.create({
      userId: "user-1",
      creationMode: "personal",
      defaultLanguage: "en",
      pageCount: 200,
      translations: [{ language: "en", title: "Personal Book" }],
    });

    const createArgs = mockCreateHistoryOutbox.mock.calls[0]?.[0] as any;
    expect(mockCreateHistoryOutbox).toHaveBeenCalledTimes(1);
    expect(createArgs.data.actorUserId).toBe("user-1");
    expect(createArgs.data.payload.revision.patch).toEqual({
      extension: { pageCount: 200 },
      translations: { en: { title: "Personal Book" } },
    });
  });

  test("create and edit projections produce identical editorial leaf paths", async () => {
    const { buildBookCreatePatch, mapBookUpdatePatchPaths } = await import(
      "./book.service"
    );
    const translation = { language: "en" as const, title: "Same State" };

    const createPaths = collectEditorialPatchLeafPaths(
      buildBookCreatePatch({
        userId: "user-1",
        pageCount: 200,
        translations: [translation],
      }),
    );
    const editPaths = [
      ...mapBookUpdatePatchPaths({ pageCount: 200 }),
      ...mapActualTranslationPatchPaths(translation, null, "en"),
    ].sort();

    expect(createPaths.sort()).toEqual(editPaths);
  });
});

describe("BookService.update", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("updates AI disclosure without modifying rating", async () => {
    const { bookService } = await import("./book.service");

    await bookService.update("book-1", {
      aiDisclosureMode: "MACHINE_GENERATED",
      aiDisclosureDetails: { disclosedBy: "MODERATOR" },
    });

    const updateArgs = mockUpdateBook.mock.calls[0]?.[0] as any;
    expect(updateArgs.data.unit.update).toMatchObject({
      aiDisclosureMode: "MACHINE_GENERATED",
      aiDisclosureDetails: { disclosedBy: "MODERATOR" },
    });
    expect(updateArgs.data.unit.update.rating).toBeUndefined();
    expect(enqueueMock.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: "search.content.patchMetadata",
      payload: {
        targetId: "book-1",
        fields: { aiDisclosureMode: "MACHINE_GENERATED" },
      },
    });
  });
});

describe("BookService.updateContentStructure (diff-based)", () => {
  beforeEach(() => {
    resetMocks();
    mockFindContainer.mockResolvedValue({
      ownerUnitId: "book-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  test("no-op save against unchanged tree issues zero row mutations", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-a", parentId: null, position: "g", title: "A" }),
      makeRow({ id: "n-b", parentId: null, position: "n", title: "B" }),
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
    expect(mockCreateHistoryOutbox).not.toHaveBeenCalled();
  });

  test("single rename issues exactly one UPDATE and bumps container once", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-a", parentId: null, position: "g", title: "Old" }),
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
    expect(latestStructureHistoryOperations()).toEqual([
      {
        op: "node.update",
        nodeId: "n-a",
        before: { title: "Old" },
        after: { title: "New" },
      },
    ]);
  });

  test("delete subtree soft-deletes targets and never hard-deletes", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-root", parentId: null, position: "g", title: "Root" }),
      makeRow({
        id: "n-child-1",
        parentId: "n-root",
        position: "g",
        title: "C1",
      }),
      makeRow({
        id: "n-child-2",
        parentId: "n-root",
        position: "n",
        title: "C2",
      }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-root", title: "Root" },
    ]);

    expect(mockDeleteManyNode).not.toHaveBeenCalled();
    expect(mockUpdateManyNode).toHaveBeenCalledTimes(2);
    const softDeleteArgs = mockUpdateManyNode.mock.calls[1]?.[0] as any;
    expect(new Set(softDeleteArgs.where.id.in)).toEqual(
      new Set(["n-child-1", "n-child-2"]),
    );
    expect(softDeleteArgs.data.isDeleted).toBe(true);
    expect(mockUpdateContainer).toHaveBeenCalledTimes(1);
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 1 },
    });
    const ops = latestStructureHistoryOperations();
    expect(ops).toHaveLength(2);
    for (const op of ops) {
      expect(op.op).toBe("node.delete");
      expect(op.softDelete).toBe(true);
    }
  });

  test("insert new sibling produces one INSERT with position between neighbors", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-a", parentId: null, position: "g", title: "A" }),
      makeRow({ id: "n-c", parentId: null, position: "n", title: "C" }),
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
    expect(createArgs.data.position > "g").toBe(true);
    expect(createArgs.data.position < "n").toBe(true);
    expect(mockUpdateContainer).toHaveBeenCalledTimes(1);
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 3 },
    });
    expect(latestStructureHistoryOperations()[0]).toMatchObject({
      op: "node.create",
      node: { title: "B (new)" },
      placement: { parentId: null },
    });
  });

  test("noContent toggles recompute readable chapter count", async () => {
    const existing: FakeRow[] = [
      makeRow({
        id: "n-a",
        parentId: null,
        position: "g",
        title: "A",
        noContent: true,
      }),
      makeRow({ id: "n-b", parentId: null, position: "n", title: "B" }),
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

  test("submitting two nodes with the same contentUnitId creates both rows", async () => {
    const existing: FakeRow[] = [
      makeRow({
        id: "n-existing",
        parentId: null,
        position: "g",
        contentUnitId: "ch-1",
        title: "Preface",
      }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-existing", title: "Preface", contentUnitId: "ch-1" },
      { title: "Preface (in appendix)", contentUnitId: "ch-1" },
    ]);

    expect(mockCreateNode).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateNode.mock.calls[0]?.[0] as any;
    expect(createArgs.data.contentUnitId).toBe("ch-1");
    expect(mockUpdateNode).not.toHaveBeenCalled();
    expect(mockUpdateBook).toHaveBeenCalledWith({
      where: { unitId: "book-1" },
      data: { chapterCount: 2 },
    });
  });

  test("move and link changes are recorded in one structure history sequence", async () => {
    const existing: FakeRow[] = [
      makeRow({ id: "n-a", parentId: null, position: "g", title: "A" }),
      makeRow({ id: "n-b", parentId: null, position: "n", title: "B" }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure(
      "book-1",
      [
        {
          id: "n-a",
          title: "A",
          children: [{ id: "n-b", title: "B", contentUnitId: "chapter-b" }],
        },
      ],
      { actorUserId: "user-1", message: "Move B under A" },
    );

    expect(mockCreateHistoryOutbox).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateHistoryOutbox.mock.calls[0]?.[0] as any;
    expect(createArgs.data.sequence).toBe(1n);
    expect(createArgs.data.actorUserId).toBe("user-1");
    expect(createArgs.data.payload.event.message).toBe("Move B under A");
    const operations = latestStructureHistoryOperations();
    expect(operations[0]).toMatchObject({
      op: "node.move",
      nodeId: "n-b",
      before: { parentId: null, position: "n" },
      after: { parentId: "n-a" },
    });
    expect(operations[0].after.position).toEqual(expect.any(String));
    expect(operations[1]).toEqual({
      op: "node.link",
      nodeId: "n-b",
      beforeContentUnitId: null,
      afterContentUnitId: "chapter-b",
    });
  });

  test("unlink changes are recorded as structure history operations", async () => {
    const existing: FakeRow[] = [
      makeRow({
        id: "n-a",
        parentId: null,
        position: "g",
        title: "A",
        contentUnitId: "chapter-a",
      }),
    ];
    mockFindNodeRows.mockResolvedValue(existing);

    const { bookService } = await import("./book.service");
    await bookService.updateContentStructure("book-1", [
      { id: "n-a", title: "A" },
    ]);

    expect(latestStructureHistoryOperations()).toEqual([
      {
        op: "node.unlink",
        nodeId: "n-a",
        beforeContentUnitId: "chapter-a",
      },
    ]);
  });
});
