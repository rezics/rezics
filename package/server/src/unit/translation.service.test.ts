import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

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
  sourceReleaseUnitId: null,
};

function freshMocks() {
  enqueueMock.mockClear();
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
    unitTranslation: {
      findUnique: mock(async () => previous),
      upsert: mock(async ({ update }: any) => ({ ...previous, ...update })),
    },
    historyOutbox: {
      create: mock(async (args: any) => args.data),
    },
  };

  Object.assign(prismaMock, {
    $transaction: mock(async (cb: any) => cb(tx)),
    unit: {
      findUnique: mock(async () => ({ type: "BOOK" })),
    },
  });

  return { tx };
}

describe("TranslationService history patches", () => {
  beforeEach(() => {
    freshMocks();
  });

  test("title-only edit stores a title-only history patch", async () => {
    const { tx } = freshMocks();
    const { translationService } = await import("./translation.service");

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
    expect(tx.historyOutbox.create).toHaveBeenCalledTimes(1);
    expect(historyArgs.data.payload.revision.patch).toEqual({
      translations: { "zh-hant": { title: "New title" } },
    });
    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.content.patchTranslations",
      "search.post.patchTargetFanout",
    ]);
  });

  test("unchanged translation submission writes no history outbox row", async () => {
    const { tx } = freshMocks();
    const { translationService } = await import("./translation.service");

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

    expect(tx.unitTranslation.upsert).not.toHaveBeenCalled();
    expect(tx.historyOutbox.create).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  test("realm translation edit enqueues realm translation projection", async () => {
    const { tx } = freshMocks();
    prismaMock.unit.findUnique.mockResolvedValueOnce({ type: "REALM" });
    const { translationService } = await import("./translation.service");

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
});
