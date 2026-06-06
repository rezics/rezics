import { describe, expect, mock, test } from "bun:test";
import type { ChapterRepository, ChapterService } from "./chapter.service";
import type { ChapterPostWithRelations } from "./types";

const bookContentStructureUpdatedAt = new Date("2026-05-06T00:00:00.000Z");
const updatedContentStructureAt = new Date("2026-05-06T00:00:01.000Z");

function chapterRow(): ChapterPostWithRelations {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    unitId: "chapter-new",
    authorUserId: "actor-user",
    scoreEntryId: null,
    kind: "CHAPTER",
    replyCount: 0,
    directReplyCount: 0,
    lastReplyAt: null,
    isLocked: false,
    extra: null,
    createdAt: now,
    updatedAt: now,
    state: null,
    variantUnitId: null,
    unit: {
      id: "chapter-new",
      type: "POST",
      slug: null,
      slugScope: "actor-user",
      userId: "actor-user",
      defaultLanguage: "zh-Hant",
      isLanguageNeutral: false,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "R_15",
      extra: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      subscriberCount: 0,
      licenseSlug: null,
      aiDisclosureMode: "UNKNOWN",
      aiDisclosureDetails: null,
      catalogEntryKind: null,
      targetUnitId: "book-1",
      moderationStatus: "APPROVED",
      user: null,
      translations: [],
      contentTranslations: [],
      supportLanguages: [],
    },
  };
}

function createRepositoryStub(
  overrides: Partial<ChapterRepository> = {},
): ChapterRepository {
  return {
    list: mock(async () => ({ items: [], total: 0 })),
    getByUnitId: mock(async () => chapterRow()),
    getUnitTarget: mock(async () => ({
      id: "book-1",
      type: "BOOK",
      defaultLanguage: "zh-Hant",
    })),
    create: mock(async () => chapterRow()),
    materializeNode: mock(async (bookUnitId, req) => ({
      bookUnitId,
      nodeId: req.nodeId,
      contentUnitId: "chapter-new",
      alreadyMaterialized: false,
      bookContentStructureUpdatedAt: updatedContentStructureAt,
    })),
    update: mock(async () => chapterRow()),
    delete: mock(async () => {}),
    exists: mock(async () => true),
    ...overrides,
  };
}

async function createService(repository: ChapterRepository) {
  const module = await import("./chapter.service");
  return new module.ChapterService(repository) as ChapterService;
}

describe("ChapterService.materializeNode", () => {
  test("materializes a node through the repository", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    const result = await service.materializeNode(
      "book-1",
      { nodeId: "n-1" },
      "actor-user",
    );

    expect(repository.materializeNode).toHaveBeenCalledWith(
      "book-1",
      { nodeId: "n-1" },
      "actor-user",
    );
    expect(result).toEqual({
      bookUnitId: "book-1",
      nodeId: "n-1",
      contentUnitId: "chapter-new",
      alreadyMaterialized: false,
      bookContentStructureUpdatedAt: updatedContentStructureAt,
    });
  });

  test("returns an existing contentUnitId without creating duplicate rows", async () => {
    const repository = createRepositoryStub({
      materializeNode: mock(async (bookUnitId, req) => ({
        bookUnitId,
        nodeId: req.nodeId,
        contentUnitId: "chapter-existing",
        alreadyMaterialized: true,
        bookContentStructureUpdatedAt,
      })),
    });
    const service = await createService(repository);

    const result = await service.materializeNode(
      "book-1",
      { nodeId: "n-1" },
      "actor-user",
    );

    expect(result).toEqual({
      bookUnitId: "book-1",
      nodeId: "n-1",
      contentUnitId: "chapter-existing",
      alreadyMaterialized: true,
      bookContentStructureUpdatedAt,
    });
  });

  test("propagates repository not-found errors for missing nodes", async () => {
    const repository = createRepositoryStub({
      materializeNode: mock(async () => {
        throw new Error("NotFound: ContentStructureNode n-1");
      }),
    });
    const service = await createService(repository);

    await expect(
      service.materializeNode("book-1", { nodeId: "n-1" }, "actor-user"),
    ).rejects.toThrow("NotFound: ContentStructureNode n-1");
  });
});
