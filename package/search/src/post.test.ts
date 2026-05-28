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
      sortPath: null,
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

  test("projects translationGroupId for wiki grouping filters", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "wiki-post-1",
      type: "POST",
      translationGroupId: "tg-artoria",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [{ language: "en", title: "Artoria", extra: null }],
      unitTags: [],
      inRealms: [{ realmUnitId: "realm-1" }],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      post: {
        kind: "WIKI",
        content: markdownContentDoc("wiki page"),
      },
    });

    expect(doc.translationGroupId).toBe("tg-artoria");
    expect(doc.realmIds).toEqual(["realm-1"]);
    expect(doc.postKind).toBe("WIKI");
  });

  test("projects rootTargetUnitId and rootTargetUnitType from the Post row", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      content: markdownContentDoc("hello"),
      kind: "REVIEW",
      depth: 0,
      sortPath: null,
      isLocked: false,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      targetUnitId: "book-B",
      rootTargetUnitId: "book-B",
      rootTargetUnitType: "BOOK",
      rootPostUnitId: "post-1",
      parentPostUnitId: null,
      authorUserId: "user-1",
      scoreEntryId: null,
      unit: { user: null, inRealms: [] },
      targetUnit: null,
      scoreEntry: null,
      extra: null,
    });

    expect(doc.rootTargetUnitId).toBe("book-B");
    expect(doc.rootTargetUnitType).toBe("BOOK");
  });

  test("falls back to null when rootTargetUnit fields are missing on the row", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-2",
      content: null,
      kind: "POST",
      depth: 0,
      sortPath: null,
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

    expect(doc.rootTargetUnitId).toBeNull();
    expect(doc.rootTargetUnitType).toBeNull();
  });

  test("uses empty realmIds when a post belongs to no realms", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      content: null,
      kind: "POST",
      depth: 0,
      sortPath: null,
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
      kind: "POST",
      depth: 0,
      sortPath: null,
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

    expect(doc.contentText).toBe("main markdown");
    expect(doc.contentText).not.toContain("Slot text");
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

  test("projects inherited work tags and release grouping fields", async () => {
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
      unitTags: [
        {
          tagUnitId: "tag-own",
          score: 1,
          tag: { translations: [{ title: "Own" }] },
        },
      ],
      workMemberships: [
        {
          workUnitId: "work-1",
          role: "RELEASE",
          position: "a0",
          displayPolicy: "PRIMARY",
          work: {
            unitTags: [
              {
                tagUnitId: "tag-work",
                score: 2,
                tag: { translations: [{ title: "Work" }] },
              },
            ],
          },
        },
      ],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      book: { textLength: 100, isLicensed: false },
    });

    expect(doc.workUnitId).toBe("work-1");
    expect(doc.searchGroupId).toBe("work-1");
    expect(doc.ownTagIds).toEqual(["tag-own"]);
    expect(doc.workTagIds).toEqual(["tag-work"]);
    expect(doc.allTagIds).toEqual(["tag-own", "tag-work"]);
    expect(doc.ownTagLabels).toEqual(["Own"]);
    expect(doc.workTagLabels).toEqual(["Work"]);
    expect(doc.allTagLabels).toEqual(["Own", "Work"]);
    expect(doc.position).toBe("a0");
    expect(doc.displayPolicy).toBe("PRIMARY");
    expect(doc.workUnitIds).toEqual(["work-1"]);
    expect(doc.workRoles).toEqual(["RELEASE"]);
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
      workMemberships: [{ workUnitId: "work-1", role: "RELEASE" }],
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

  test("buildPostDocument projects UnitWork membership fields", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");

    const doc = buildPostDocument({
      unitId: "post-1",
      content: { type: "doc", content: [] },
      kind: "REVIEW",
      depth: 0,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      unit: {
        user: null,
        inRealms: [],
        workMemberships: [{ workUnitId: "work-1", role: "REVIEW" }],
      },
      scoreEntry: null,
    });

    expect(doc.workUnitIds).toEqual(["work-1"]);
    expect(doc.workRoles).toEqual(["REVIEW"]);
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
        workUnitId: null,
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
        workUnitId: null,
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "DELETED",
        visibility: "PUBLIC",
        workUnitId: null,
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        workUnitId: "work-1",
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

  test("rejects hidden Work Units that aggregate releases", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit } = await import("./sync");
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        workMembers: [{ unitId: "release-1" }],
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
          workMembers: [],
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
          workMembers: [],
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
