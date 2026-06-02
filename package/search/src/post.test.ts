import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";

function setServerEnvForSearchTests() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/rezics_book";
  process.env.AUTH_INTERNAL_BASE_URL ??= "http://localhost:4001";
  process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:4001";
  process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:4001";
  process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "test-secret";
  process.env.SMTP_HOST ??= "localhost";
  process.env.SMTP_USER ??= "test";
  process.env.SMTP_PASSWORD ??= "test";
  process.env.TURNSTILE_SECRET ??= "test";
  process.env.MEILI_HOST ??= "http://localhost:7700";
  process.env.MEILI_MASTER_KEY ??= "masterKey";
  process.env.NOTIFY_BASE_URL ??= "http://localhost:4002";
  process.env.NOTIFY_INTERNAL_SECRET ??= "test-secret";
  process.env.REACTION_BASE_URL ??= "http://localhost:4003";
  process.env.REACTION_INTERNAL_SECRET ??= "test-secret";
}

describe("buildPostDocument", () => {
  test("includes only visible non-hidden realmIds from UnitRealm rows", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      content: markdownContentDoc("hello"),
      kind: "POST",
      depth: 0,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      targetUnitId: null,
      rootPostUnitId: null,
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: {
        user: { name: "Alice", slug: "alice", avatar: null },
        inRealms: [
          { realmUnitId: "realm-1", state: "VISIBLE" },
          { realmUnitId: "realm-2", state: "VISIBLE" },
          { realmUnitId: "realm-3", state: "ARCHIVED" },
          {
            realmUnitId: "realm-private",
            state: "VISIBLE",
            realm: { realm: { isPublic: false } },
          },
        ],
        realmModerationTargets: [
          { realmUnitId: "realm-2", state: "ARCHIVED" },
          { realmUnitId: "realm-4", state: "LOCKED" },
        ],
      },
      targetUnit: null,
      scoreEntry: null,
      extra: null,
    });

    expect(doc.realmIds).toEqual(["realm-1"]);
  });

  test("projects targetUnitId from the owning Unit row", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      content: markdownContentDoc("hello"),
      kind: "REVIEW",
      depth: 0,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      targetUnitId: null,
      rootPostUnitId: "post-1",
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: { targetUnitId: "book-B", user: null, inRealms: [] },
      targetUnit: null,
      scoreEntry: null,
      extra: null,
    });

    expect(doc.targetUnitId).toBe("book-B");
  });

  test("projects variantUnitId from the Post row as weak context", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      variantUnitId: "variant-1",
      content: markdownContentDoc("hello"),
      kind: "REVIEW",
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: { targetUnitId: "book-B", user: null, inRealms: [] },
      targetUnit: null,
      scoreEntry: null,
      extra: null,
    });

    expect(doc.targetUnitId).toBe("book-B");
    expect(doc.variantUnitId).toBe("variant-1");
  });

  test("falls back to null when targetUnitId is missing on the row", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-2",
      content: null,
      kind: "POST",
      depth: 0,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      targetUnitId: null,
      rootPostUnitId: null,
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: { user: null, inRealms: [] },
      targetUnit: null,
      scoreEntry: null,
    });

    expect(doc.targetUnitId).toBeNull();
  });

  test("uses empty realmIds when a post belongs to no realms", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      content: null,
      kind: "POST",
      depth: 0,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      targetUnitId: null,
      rootPostUnitId: null,
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: { user: null, inRealms: [] },
      targetUnit: null,
      scoreEntry: null,
    });

    expect(doc.realmIds).toEqual([]);
  });

  test("projects contentText from main markdown only", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      kind: "POST",
      depth: 0,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      targetUnitId: null,
      rootPostUnitId: null,
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: {
        user: null,
        inRealms: [],
        defaultLanguage: "en",
        supportLanguages: [],
        translations: [],
        contentTranslations: [
          {
            language: "en",
            content: {
              ...markdownContentDoc("main markdown"),
              slots: {
                facts: {
                  type: "infobox",
                  rows: [
                    {
                      label: { type: "markdown", source: "Author" },
                      value: { type: "markdown", source: "Slot text" },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
      targetUnit: null,
      scoreEntry: null,
    });

    expect(doc.contentText).toBe("main markdown");
    expect(doc.contentText).not.toContain("Slot text");
  });

  test("resolves root post title and content from translations only", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      content: markdownContentDoc("legacy body"),
      kind: "POST",
      depth: 0,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      targetUnitId: null,
      rootPostUnitId: null,
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: {
        user: null,
        inRealms: [],
        defaultLanguage: "ja",
        supportLanguages: [
          { language: "en", isPrimary: true, sortOrder: 1 },
          { language: "ja", isPrimary: false, sortOrder: 2 },
        ],
        translations: [
          { language: "en", title: "English title" },
          { language: "ja", title: "Japanese title" },
        ],
        contentTranslations: [
          { language: "en", content: markdownContentDoc("English body") },
          { language: "ja", content: markdownContentDoc("Japanese body") },
        ],
      },
      targetUnit: null,
      scoreEntry: null,
      extra: { title: "Legacy title" },
    });

    expect(doc.titleText).toBe("Japanese title");
    expect(doc.contentText).toBe("Japanese body");
  });

  test("does not fall back to legacy post title or body storage", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      content: markdownContentDoc("legacy body"),
      kind: "POST",
      depth: 0,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      targetUnitId: null,
      rootPostUnitId: null,
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: {
        user: null,
        inRealms: [],
        defaultLanguage: "en",
        supportLanguages: [],
        translations: [],
        contentTranslations: [],
      },
      targetUnit: null,
      scoreEntry: null,
      extra: { title: "Legacy title" },
    });

    expect(doc.titleText).toBeNull();
    expect(doc.contentText).toBeNull();
  });
});

describe("buildContentDocument realm tag keys", () => {
  test("realmTagKeys can exist without matching realmIds", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "unit-1",
      type: "BOOK",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [{ language: "en", title: "Book", extra: null }],
      unitTags: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [
        { realmUnitId: "realm-1", tagUnitId: "tag-1" },
      ],
      creditAttributions: [],
      book: { textLength: 100, isLicensed: false },
    });

    expect(doc.realmIds).toEqual([]);
    expect(doc.realmTagKeys).toEqual(["realm-1:tag-1"]);
  });

  test("projects direct Series metadata without nested expansion", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "release-1",
      type: "BOOK",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [{ language: "en", title: "Release", extra: null }],
      unitTags: [],
      seriesContentIndexesAsRelease: [
        {
          seriesUnitId: "series-1",
          releaseUnitId: "release-1",
          contentNodeId: "node-1",
          series: {
            kindKey: "book_series",
            unit: {
              translations: [{ language: "en", title: "Direct Series" }],
            },
          },
        },
      ],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      book: { textLength: 100, isLicensed: false },
    });

    expect(doc.seriesUnitIds).toEqual(["series-1"]);
    expect(doc.seriesKindKeys).toEqual(["book_series"]);
    expect(doc.seriesTitles).toEqual(["Direct Series"]);
  });

  test("accepts Series as first-class searchable content", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit } = await import("./sync");

    expect(
      isPublicIndexableContentUnit({
        type: "SERIES",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        contentModerationState: null,
      }),
    ).toBe(true);
  });

  test("projects main markdown and ignores slot text for runtime v1", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "post-1",
      type: "POST",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [
        {
          language: "en",
          title: "Post",
          description: {
            ...markdownContentDoc("description main"),
            slots: {
              facts: {
                type: "infobox",
                rows: [
                  {
                    label: { type: "markdown", source: "Description slot" },
                    value: { type: "markdown", source: "Hidden description" },
                  },
                ],
              },
            },
          },
          extra: null,
        },
      ],
      unitTags: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      post: {
        kind: "POST",
        content: {
          ...markdownContentDoc("content main"),
          slots: {
            facts: {
              type: "infobox",
              rows: [
                {
                  label: { type: "markdown", source: "Content slot" },
                  value: { type: "markdown", source: "Hidden content" },
                },
              ],
            },
          },
        },
      },
    });

    expect(doc.contentText).toBe("content main");
    expect(doc.descriptionText).toBe("description main");
    expect(doc.contentText).not.toContain("Hidden content");
    expect(doc.descriptionText).not.toContain("Hidden description");
  });
});

describe("buildContentDocument subject attributions", () => {
  test("subject names do not pollute creditNames", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "fanfic-1",
      type: "BOOK",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [{ language: "en", title: "Fanfic", extra: null }],
      unitTags: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [
        {
          entityId: "character-1",
          role: "primary_character",
          entity: {
            entity: { kind: "character" },
            translations: [
              { language: "en", title: "Aster", extra: null },
              { language: "ja", title: "Aster JP", extra: null },
            ],
          },
        },
      ],
      book: { textLength: 100, isLicensed: false },
    });

    expect(doc.creditNames).toEqual([]);
    expect(doc.subjectEntityIds).toEqual(["character-1"]);
    expect(doc.subjectNames).toEqual(["Aster", "Aster JP"]);
    expect(doc.subjectKinds).toEqual(["character"]);
    expect(doc.subjectRoles).toEqual(["primary_character"]);
  });
});

describe("buildContentDocument containedUnitIds", () => {
  const baseUnit = {
    defaultLanguage: "en",
    visibility: "PUBLIC",
    rating: "GENERAL",
    userId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    publishedAt: null,
    unitTags: [],
    inRealms: [],
    realmTagApplicationsAsTargetUnit: [],
    creditAttributions: [],
  };

  test("SHELF unit with three items projects all three ids", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      ...baseUnit,
      id: "shelf-1",
      type: "SHELF",
      translations: [{ language: "en", title: "My Shelf", extra: null }],
      shelf: {
        units: [{ unitId: "u-a" }, { unitId: "u-b" }, { unitId: "u-c" }],
      },
    });

    expect((doc as { containedUnitIds?: string[] }).containedUnitIds).toEqual([
      "u-a",
      "u-b",
      "u-c",
    ]);
  });

  test("BOOK unit omits containedUnitIds entirely", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      ...baseUnit,
      id: "book-1",
      type: "BOOK",
      translations: [{ language: "en", title: "Book", extra: null }],
      book: { textLength: 100, isLicensed: false },
    });

    expect(
      (doc as { containedUnitIds?: string[] }).containedUnitIds,
    ).toBeUndefined();
  });
});

describe("public content indexing eligibility", () => {
  test("accepts published public indexable Units", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit } = await import("./sync");
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
      }),
    ).toBe(true);
  });

  test("rejects private and deleted Units while accepting releases", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit } = await import("./sync");
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PRIVATE",
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "DELETED",
        visibility: "PUBLIC",
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
      }),
    ).toBe(true);
  });

  test("rejects globally removed content states", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit, isPublicIndexablePostUnit } =
      await import("./sync");

    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        contentModerationState: { state: "TOMBSTONED" },
      }),
    ).toBe(false);
    expect(
      isPublicIndexablePostUnit({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        contentModerationState: { state: "HIDDEN" },
      }),
    ).toBe(false);
    expect(
      isPublicIndexablePostUnit({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        contentModerationState: { state: "LOCKED" },
      }),
    ).toBe(true);
  });

  test("rejects variant and non-catalog content Units from generic content indexing", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit } = await import("./sync");
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        catalogEntryKind: "VARIANT",
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        catalogEntryKind: "NONE",
      }),
    ).toBe(false);
  });

  test("rejects private and deleted post backing Units", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexablePostUnit } = await import("./sync");
    expect(
      isPublicIndexablePostUnit({
        status: "PUBLISHED",
        visibility: "PUBLIC",
      }),
    ).toBe(true);
    expect(
      isPublicIndexablePostUnit({
        status: "PUBLISHED",
        visibility: "PRIVATE",
      }),
    ).toBe(false);
    expect(
      isPublicIndexablePostUnit({
        status: "DELETED",
        visibility: "PUBLIC",
      }),
    ).toBe(false);
  });

  test("rejects private and hidden wiki content Units", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit } = await import("./sync");

    expect(
      isPublicIndexableContentUnit({
        type: "POST",
        status: "PUBLISHED",
        visibility: "PRIVATE",
        contentModerationState: null,
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "POST",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        contentModerationState: { state: "HIDDEN" },
      }),
    ).toBe(false);
  });
});

describe("search sync global moderation projection", () => {
  test("syncSingleContent deletes globally tombstoned content", async () => {
    setServerEnvForSearchTests();
    const { setSearchPrismaClient, syncSingleContent } = await import("./sync");
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const addOrUpdateContent = mock(async (_docs: any[]) => undefined);

    setSearchPrismaClient({
      unit: {
        findUnique: mock(async () => ({
          id: "book-1",
          type: "BOOK",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          contentModerationState: { state: "TOMBSTONED" },
          catalogEntryKind: null,
        })),
      },
    } as any);

    await syncSingleContent(
      { deleteContent, addOrUpdateContent } as any,
      "book-1",
    );

    expect(deleteContent).toHaveBeenCalledWith(["book-1"]);
    expect(addOrUpdateContent).not.toHaveBeenCalled();
  });

  test("syncSinglePost deletes globally hidden posts", async () => {
    setServerEnvForSearchTests();
    const { setSearchPrismaClient, syncSinglePost } = await import("./sync");
    const deletePosts = mock(async (_ids: string[]) => undefined);
    const addOrUpdatePosts = mock(async (_docs: any[]) => undefined);

    setSearchPrismaClient({
      post: {
        findUnique: mock(async () => ({
          unitId: "post-1",
          unit: {
            status: "PUBLISHED",
            visibility: "PUBLIC",
            contentModerationState: { state: "HIDDEN" },
          },
        })),
      },
    } as any);

    await syncSinglePost({ deletePosts, addOrUpdatePosts } as any, "post-1");

    expect(deletePosts).toHaveBeenCalledWith(["post-1"]);
    expect(addOrUpdatePosts).not.toHaveBeenCalled();
  });

  test("realm id patches exclude hidden realm overlays", async () => {
    setServerEnvForSearchTests();
    const { patchContentRealmIds, setSearchPrismaClient } = await import(
      "./sync"
    );
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const realmContentModerationFindMany = mock(async () => [
      { realmUnitId: "realm-a", state: "LOCKED" },
      { realmUnitId: "realm-b", state: "ARCHIVED" },
    ]);

    setSearchPrismaClient({
      unit: {
        findUnique: mock(async () => ({
          type: "BOOK",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          contentModerationState: null,
          catalogEntryKind: null,
        })),
      },
      unitRealm: {
        findMany: mock(async () => [
          {
            realmUnitId: "realm-a",
            state: "VISIBLE",
            realm: { realm: { isPublic: true } },
          },
          {
            realmUnitId: "realm-b",
            state: "VISIBLE",
            realm: { realm: { isPublic: true } },
          },
          {
            realmUnitId: "realm-private",
            state: "VISIBLE",
            realm: { realm: { isPublic: false } },
          },
        ]),
      },
      realmContentModeration: {
        findMany: realmContentModerationFindMany,
      },
    } as any);

    await patchContentRealmIds(
      { patchContent, deleteContent } as any,
      "post-1",
    );

    expect(patchContent).toHaveBeenCalledWith([
      { id: "post-1", realmIds: ["realm-a"] },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
    expect(realmContentModerationFindMany).toHaveBeenCalledWith({
      where: { targetUnitId: "post-1" },
      select: { realmUnitId: true, state: true },
    });
  });
});
