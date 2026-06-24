import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import type { ChapterRepository, ChapterService } from "./chapter.service";
import type { ChapterPostWithRelations } from "./types";

function chapterRow(
  overrides: Partial<ChapterPostWithRelations> = {},
): ChapterPostWithRelations {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    unitId: "ch-1",
    authorUserId: "author-1",
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
      id: "ch-1",
      type: "POST",
      slug: null,
      slugScope: "author-1",
      userId: "author-1",
      defaultLanguage: "en",
      isLanguageNeutral: false,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      extra: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      subscriberCount: 0,
      referenceCount: 0,
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
    ...overrides,
  };
}

function createRepositoryStub(
  overrides: Partial<ChapterRepository> = {},
): ChapterRepository {
  return {
    list: mock(async () => ({ items: [], total: 0 })),
    getByUnitId: mock(async (unitId) => chapterRow({ unitId })),
    getUnitTarget: mock(async () => ({
      id: "book-1",
      type: "BOOK",
      defaultLanguage: "en",
    })),
    create: mock(async () => chapterRow()),
    materializeNode: mock(async (bookUnitId, req) => ({
      bookUnitId,
      nodeId: req.nodeId,
      contentUnitId: "chapter-new",
      alreadyMaterialized: false,
      bookContentStructureUpdatedAt: new Date("2026-05-06T00:00:01.000Z"),
    })),
    update: mock(async (unitId) => chapterRow({ unitId })),
    delete: mock(async () => {}),
    exists: mock(async () => true),
    ...overrides,
  };
}

async function createService(repository: ChapterRepository) {
  const module = await import("./chapter.service");
  return new module.ChapterService(repository) as ChapterService;
}

const content = (source: string) => markdownContentDoc(source);

describe("ChapterService.update", () => {
  test("content-only edit is delegated without target validation", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.update("ch-1", { content: content("new body") });

    expect(repository.getUnitTarget).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith("ch-1", {
      content: content("new body"),
    });
  });

  test("title rename is delegated for propagation in the repository", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.update("ch-1", { title: "Renamed" });

    expect(repository.update).toHaveBeenCalledWith("ch-1", {
      title: "Renamed",
    });
  });

  test("validates retargets must point at a book Unit", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async () => ({ type: "POST" })),
    });
    const service = await createService(repository);

    await expect(
      service.update("ch-1", { targetUnitId: "post-1" }),
    ).rejects.toThrow(/Unit\(type=BOOK\)/);
    expect(repository.update).not.toHaveBeenCalled();
  });

  test("status-only update delegates without structure propagation work in the service", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.update("ch-1", { status: "DRAFT" });

    expect(repository.update).toHaveBeenCalledWith("ch-1", {
      status: "DRAFT",
    });
  });
});

describe("ChapterService.create", () => {
  test("requires targetUnitId to reference a book", async () => {
    const repository = createRepositoryStub({
      getUnitTarget: mock(async () => ({ type: "MEDIA" })),
    });
    const service = await createService(repository);

    await expect(
      service.create({
        userId: "user-1",
        targetUnitId: "media-1",
        title: "Chapter",
      }),
    ).rejects.toThrow(/Unit\(type=BOOK\)/);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
