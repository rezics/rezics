import { beforeEach, describe, expect, mock, test } from "bun:test";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: mock(async () => undefined),
  patchContentContainedUnitIdsToMeili: mock(async () => undefined),
  patchContentCreditsToMeili: mock(async () => undefined),
  patchContentMetadataToMeili: mock(async () => undefined),
  patchContentRealmIdsToMeili: mock(async () => undefined),
  patchContentRealmTagKeysToMeili: mock(async () => undefined),
  patchContentSubjectsToMeili: mock(async () => undefined),
  patchContentTagsToMeili: mock(async () => undefined),
  patchContentTranslationsToMeili: mock(async () => undefined),
  syncContentToMeili: mock(async () => undefined),
}));
mock.module("@/meili/post/sync", () => ({
  deletePostFromMeili: mock(async () => undefined),
  patchPostFieldsToMeili: mock(async () => undefined),
  patchPostsAuthorToMeili: mock(async () => undefined),
  patchPostsTargetToMeili: mock(async () => undefined),
  syncAllPostsToMeili: mock(async () => undefined),
  syncPostToMeili: mock(async () => undefined),
  syncPostsByAuthorToMeili: mock(async () => undefined),
  syncPostsByTargetToMeili: mock(async () => undefined),
}));
mock.module("@/meili/realm/sync", () => ({
  patchRealmTranslationsToMeili: mock(async () => undefined),
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const previous = {
  unitId: "book-1",
  language: "zh-hant",
  title: "Old title",
  subtitle: "Same subtitle",
  summary: "Same summary",
  description: { type: "doc", content: [] },
  extra: null,
  sourceUnitId: null,
};

function freshMocks() {
  enqueueMock.mockClear();
  const getUnitType = mock(async () => "BOOK");
  const tx = {
    $queryRaw: mock(async () => [{ sequence: 1n }]),
    unit: {
      findUniqueOrThrow: mock(async () => ({ id: "book-1", userId: "user-1" })),
    },
    unitCollaborator: {
      findUnique: mock(async () => null),
    },
    unitFieldLock: {
      findMany: mock(async () => []),
    },
    staffAuditLog: {
      create: mock(async (args: any) => args.data),
    },
    unitTranslation: {
      findUnique: mock(async () => previous),
      upsert: mock(async ({ update }: any) => ({ ...previous, ...update })),
    },
    findTranslation: mock(async () => previous),
    upsertTranslation: mock(async (_unitId, _language, _create, update) => ({
      ...previous,
      ...update,
    })),
    historyOutbox: {
      create: mock(async (args: any) => args.data),
    },
  };

  const repository = {
    getTranslation: mock(async () => previous),
    listByUnitId: mock(async () => [previous]),
    transaction: mock(async (cb: any) => cb(tx)),
    getUnitType,
    deleteTranslation: mock(async () => undefined),
    findTranslation: mock(async () => previous),
    findFirstTranslation: mock(async () => previous),
  };

  return { tx, repository, getUnitType };
}

describe("TranslationService history patches", () => {
  beforeEach(() => {
    freshMocks();
  });

  test("title-only edit stores a title-only history patch", async () => {
    const { tx, repository } = freshMocks();
    const { TranslationService } = await import("./translation.service");
    const translationService = new TranslationService(repository as any);

    await translationService.upsertTranslation(
      "book-1",
      "zh-hant",
      {
        title: "New title",
        subtitle: "Same subtitle",
        summary: "Same summary",
        description: { type: "doc", content: [] },
      },
      { userId: "user-1", permission: { role: "ROOT" } } as any,
    );

    const historyArgs = (tx.historyOutbox.create as any).mock.calls[0]?.[0];
    expect(tx.unit.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "book-1" },
      select: { id: true, userId: true },
    });
    expect(tx.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(tx.staffAuditLog.create).not.toHaveBeenCalled();
    expect(historyArgs.data.payload.revision.patch).toEqual({
      translations: { "zh-hant": { title: "New title" } },
    });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchTranslations",
      "search.post.patchTargetFanout",
    ]);
  });

  test("unchanged translation submission writes no history outbox row", async () => {
    const { tx, repository } = freshMocks();
    const { TranslationService } = await import("./translation.service");
    const translationService = new TranslationService(repository as any);

    await translationService.upsertTranslation(
      "book-1",
      "zh-hant",
      {
        title: "Old title",
        subtitle: "Same subtitle",
        summary: "Same summary",
        description: { type: "doc", content: [] },
      },
      { userId: "user-1", permission: { role: "USER" } } as any,
    );

    expect(tx.upsertTranslation).not.toHaveBeenCalled();
    expect(tx.historyOutbox.create).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  test("rejects game system requirement raw text in translation extra", async () => {
    const { tx, repository } = freshMocks();
    const { TranslationService } = await import("./translation.service");
    const translationService = new TranslationService(repository as any);

    await expect(
      translationService.upsertTranslation("book-1", "zh-hant", {
        extra: {
          coverUrl: "https://example.test/cover.jpg",
          systemRequirementRawText: "Requires a 64-bit processor.",
        },
      }),
    ).rejects.toThrow(/Game system requirement raw text/);

    expect(tx.upsertTranslation).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  test("realm translation edit enqueues realm translation projection", async () => {
    const { tx, repository, getUnitType } = freshMocks();
    getUnitType.mockResolvedValueOnce("REALM");
    const { TranslationService } = await import("./translation.service");
    const translationService = new TranslationService(repository as any);

    await translationService.upsertTranslation(
      "realm-1",
      "zh-hant",
      {
        title: "New title",
        subtitle: "Same subtitle",
        summary: "Same summary",
        description: { type: "doc", content: [] },
      },
      { userId: "user-1", permission: { role: "ROOT" } } as any,
    );

    expect(tx.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.realm.patchTranslations",
    ]);
  });

  test("cross-owner translation edits write staff audit and revision history", async () => {
    const { tx, repository } = freshMocks();
    tx.unit.findUniqueOrThrow.mockResolvedValue({
      id: "book-1",
      userId: "owner-1",
    });
    const { TranslationService } = await import("./translation.service");
    const translationService = new TranslationService(repository as any);

    await translationService.upsertTranslation(
      "book-1",
      "zh-hant",
      {
        title: "New title",
        subtitle: "Same subtitle",
        summary: "Same summary",
        description: { type: "doc", content: [] },
      },
      { userId: "staff-1", permission: { role: "ROOT" } } as any,
    );

    expect(tx.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(tx.staffAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "staff-1",
        action: "content.editorial.cross_owner_update",
        targetKind: "unit",
        targetId: "book-1",
        decisionCode: "ALLOWED",
        reason: "unit.translation.upsert",
        before: {
          ownerUserId: "owner-1",
          patchPaths: ["translations.zh-hant.title"],
        },
        after: {
          patch: { translations: { "zh-hant": { title: "New title" } } },
        },
      }),
    });
  });
});
