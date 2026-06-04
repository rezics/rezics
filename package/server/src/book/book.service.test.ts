import { collectEditorialPatchLeafPaths } from "@rezics/contract";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mapActualTranslationPatchPaths } from "@/unit/collaborative-metadata";
import type { BookRepository } from "./book.service";
import type { BookWithRelations } from "./types";

const enqueueMock = mock(async (_command: unknown) => ({ status: "created" }));
const contentStructureUpdateMock = mock(
  async (_ownerId: string, submitted: any[], options: any) => {
    await options.afterMutate?.(
      { source: "content-structure-tx" },
      { submitted },
    );
    return {
      ownerUnitId: "book-1",
      nodes: submitted,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
  },
);

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/content-structure", () => ({
  contentStructureService: {
    getByOwnerUnitId: mock(async () => ({
      ownerUnitId: "book-1",
      nodes: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })),
    update: contentStructureUpdateMock,
  },
}));

const { BookService, buildBookCreatePatch, mapBookUpdatePatchPaths } =
  await import("./book.service");

function bookRow(unitId = "book-1"): BookWithRelations {
  return {
    unitId,
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
    unit: {
      id: unitId,
      type: "BOOK",
      slug: null,
      slugScope: "user-1",
      userId: "user-1",
      defaultLanguage: "en",
      isLanguageNeutral: false,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      extra: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      subscriberCount: 0,
      licenseSlug: null,
      aiDisclosureMode: "UNKNOWN",
      aiDisclosureDetails: null,
      catalogEntryKind: null,
      targetUnitId: null,
      moderationStatus: "APPROVED",
      user: null,
      translations: [],
      supportLanguages: [],
      creditAttributions: [],
    },
  };
}

function createRepository(
  overrides: Partial<BookRepository> = {},
): BookRepository {
  return {
    list: mock(async () => ({ books: [], total: 0 })),
    getByUnitId: mock(async (unitId) => bookRow(unitId)),
    getByIsbn13: mock(async () => bookRow()),
    create: mock(async () => bookRow()),
    update: mock(async (unitId) => bookRow(unitId)),
    updateChapterCount: mock(async () => undefined),
    delete: mock(async () => undefined),
    exists: mock(async () => true),
    ...overrides,
  };
}

describe("BookService", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
    contentStructureUpdateMock.mockClear();
  });

  test("create delegates storage and enqueues content sync", async () => {
    const repository = createRepository();
    const service = new BookService(repository);

    await service.create({
      userId: "user-1",
      defaultLanguage: "en",
      translations: [{ language: "en", title: "Book" }],
    });

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      defaultLanguage: "en",
      translations: [{ language: "en", title: "Book" }],
    });
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.sync",
      payload: { unitId: "book-1" },
      source: { type: "server", service: "book" },
    });
  });

  test("update delegates storage and enqueues metadata patch fields", async () => {
    const repository = createRepository();
    const service = new BookService(repository);

    await service.update("book-1", {
      aiDisclosureMode: "MACHINE_GENERATED",
      aiDisclosureDetails: { disclosedBy: "MODERATOR" },
      rating: "GENERAL",
    });

    expect(repository.update).toHaveBeenCalledWith(
      "book-1",
      {
        aiDisclosureMode: "MACHINE_GENERATED",
        aiDisclosureDetails: { disclosedBy: "MODERATOR" },
        rating: "GENERAL",
      },
      undefined,
      undefined,
    );
    expect(enqueueMock.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: "search.content.patchMetadata",
      payload: {
        targetId: "book-1",
        fields: {
          aiDisclosureMode: "MACHINE_GENERATED",
          rating: "GENERAL",
        },
      },
    });
  });

  test("updateContentStructure recomputes readable chapter count inside the structure mutation", async () => {
    const repository = createRepository();
    const service = new BookService(repository);

    await service.updateContentStructure("book-1", [
      { title: "Readable" },
      { title: "Part", noContent: true },
      { title: "Appendix", children: [{ title: "Readable child" }] },
    ]);

    expect(contentStructureUpdateMock).toHaveBeenCalledWith(
      "book-1",
      expect.any(Array),
      expect.objectContaining({
        eventType: "contentStructure.content.batch",
        changedFieldKeys: ["contentStructure"],
      }),
    );
    expect(repository.updateChapterCount).toHaveBeenCalledWith(
      { source: "content-structure-tx" },
      "book-1",
      3,
    );
  });

  test("delete delegates storage and enqueues content delete", async () => {
    const repository = createRepository();
    const service = new BookService(repository);

    await service.delete("book-1");

    expect(repository.delete).toHaveBeenCalledWith("book-1");
    expect(enqueueMock.mock.calls.at(-1)?.[0]).toMatchObject({
      kind: "search.content.delete",
      payload: { unitId: "book-1" },
      source: { type: "server", service: "book" },
    });
  });
});

describe("book editorial patch helpers", () => {
  test("create and edit projections produce identical editorial leaf paths", () => {
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
