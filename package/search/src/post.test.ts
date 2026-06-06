import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    ["then"](resolve: (value: unknown[]) => unknown) {
      return Promise.resolve(resolve(rowSets.shift() ?? []));
    },
    leftJoin() {
      return createChain();
    },
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

const contentUnitRow = {
  id: "book-1",
  type: "BOOK",
  status: "PUBLISHED",
  visibility: "PUBLIC",
  moderationStatus: "APPROVED",
  catalogEntryKind: null,
  defaultLanguage: "en",
  isLanguageNeutral: false,
  rating: "GENERAL",
  aiDisclosureMode: "UNKNOWN",
  userId: "user-1",
  targetUnitId: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  publishedAt: new Date("2026-06-03T00:00:00.000Z"),
};

function contentHydrationRows() {
  return [
    [
      {
        unitId: "book-1",
        language: "en",
        title: "Drizzle Book",
        subtitle: null,
        summary: "Book summary",
        description: markdownContentDoc("Book description"),
      },
    ],
    [],
    [{ unitId: "book-1", language: "en", isPrimary: true, sortOrder: 0 }],
    [
      {
        unitId: "book-1",
        value: "Alias",
        score: 3,
        pinned: false,
        status: "ACTIVE",
      },
    ],
    [
      {
        unitId: "book-1",
        tagUnitId: "tag-1",
        score: 5,
        pinned: false,
        tagSlug: "tag",
        title: "Tag",
      },
    ],
    [
      {
        unitId: "book-1",
        realmUnitId: "realm-1",
        moderationStatus: "APPROVED",
        isLocked: false,
        realm: { realm: { isPublic: true } },
      },
    ],
    [{ unitId: "book-1", realmUnitId: "realm-1", tagUnitId: "tag-1" }],
    [
      {
        unitId: "book-1",
        entityId: "person-1",
        role: "author",
        sortOrder: 0,
        kind: "person",
        title: "Alice",
      },
    ],
    [
      {
        unitId: "book-1",
        entityId: "subject-1",
        role: "topic",
        sortOrder: 0,
        kind: "concept",
        title: "Topic",
      },
    ],
    [{ unitId: "book-1", isLicensed: true, textLength: 123 }],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  ];
}

const postBaseRow = {
  unitId: "post-1",
  authorUserId: "user-1",
  scoreEntryId: "score-1",
  kind: "POST",
  replyCount: 1,
  directReplyCount: 1,
  lastReplyAt: null,
  isLocked: false,
  extra: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  variantUnitId: null,
  targetUnitId: "book-1",
  unitStatus: "PUBLISHED",
  unitVisibility: "PUBLIC",
  unitModerationStatus: "APPROVED",
  unitDefaultLanguage: "en",
  unitIsLanguageNeutral: false,
  unitUserId: "user-1",
};

function postHydrationRows() {
  return [
    [{ unitId: "user-1", name: "Alice", slug: "alice", avatar: "avatar.png" }],
    [{ unitId: "post-1", language: "en", title: "Post title" }],
    [
      {
        unitId: "post-1",
        language: "en",
        content: markdownContentDoc("Post body"),
      },
    ],
    [{ unitId: "post-1", language: "en", isPrimary: true, sortOrder: 0 }],
    [
      {
        unitId: "post-1",
        realmUnitId: "realm-1",
        moderationStatus: "APPROVED",
        isLocked: false,
        realm: { realm: { isPublic: true } },
      },
    ],
    [{ id: "book-1", type: "BOOK", defaultLanguage: "en" }],
    [{ unitId: "book-1", language: "en", title: "Target book" }],
    [{ id: "score-1", value: 5, fields: { story: 5 } }],
  ];
}

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
  test("includes only approved non-hidden realmIds from UnitRealm rows", async () => {
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
          {
            realmUnitId: "realm-1",
            moderationStatus: "APPROVED",
          },
          {
            realmUnitId: "realm-2",
            moderationStatus: "REMOVED",
          },
          {
            realmUnitId: "realm-3",
            moderationStatus: "PENDING",
          },
          {
            realmUnitId: "realm-locked",
            moderationStatus: "APPROVED",
            isLocked: true,
          },
          {
            realmUnitId: "realm-private",
            moderationStatus: "APPROVED",
            realm: { realm: { isPublic: false } },
          },
        ],
      },
      targetUnit: null,
      scoreEntry: null,
      extra: null,
    });

    expect(doc.realmIds).toEqual(["realm-1", "realm-locked"]);
  });

  test("projects targetUnitId from the owning Unit row", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
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

  test("indexes language availability from the post Unit support languages", async () => {
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
        isLanguageNeutral: false,
        supportLanguages: [
          { language: "ja", isPrimary: true, sortOrder: 0 },
          { language: "en", isPrimary: false, sortOrder: 1 },
        ],
        translations: [
          { language: "en", title: "English title", extra: null },
          { language: "ko", title: "Translation-only title", extra: null },
        ],
      },
      targetUnit: null,
      scoreEntry: null,
    });

    expect(doc.languages).toEqual(["ja", "en"]);
    expect(doc.supportLanguages).toEqual([
      { language: "ja", isPrimary: true, sortOrder: 0 },
      { language: "en", isPrimary: false, sortOrder: 1 },
    ]);
  });

  test("falls back to null when targetUnitId is missing on the row", async () => {
    setServerEnvForSearchTests();
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-2",
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

  test("resolves root post title and content from translations", async () => {
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
    });

    expect(doc.titleText).toBe("Japanese title");
    expect(doc.contentText).toBe("Japanese body");
  });

  test("returns null title and content when translations are absent", async () => {
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
        contentTranslations: [],
      },
      targetUnit: null,
      scoreEntry: null,
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
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
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
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
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
        moderationStatus: "APPROVED",
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
      },
      contentTranslations: [
        {
          language: "en",
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
      ],
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
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
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
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
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
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
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
      book: { textLength: 100, isLicensed: false },
    });

    expect(
      (doc as { containedUnitIds?: string[] }).containedUnitIds,
    ).toBeUndefined();
  });
});

describe("buildContentDocument language availability", () => {
  test("indexes preferred-filter languages from UnitSupportLanguage rows only", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "book-1",
      type: "BOOK",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [
        { language: "en", title: "English title", extra: null },
        { language: "ja", title: "Japanese title", extra: null },
      ],
      supportLanguages: [
        { language: "ja", isPrimary: true, sortOrder: 0 },
        { language: "en", isPrimary: false, sortOrder: 1 },
        { language: "ja", isPrimary: false, sortOrder: 2 },
      ],
      unitTags: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      book: { textLength: 100, isLicensed: false },
    });

    expect(doc.languages).toEqual(["ja", "en"]);
    expect(doc.supportLanguages).toEqual([
      { language: "ja", isPrimary: true, sortOrder: 0 },
      { language: "en", isPrimary: false, sortOrder: 1 },
      { language: "ja", isPrimary: false, sortOrder: 2 },
    ]);
  });

  test("does not infer preferred-filter languages from translation-only data", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "book-unrepaired",
      type: "BOOK",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [{ language: "en", title: "Needs repair", extra: null }],
      supportLanguages: [],
      unitTags: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      book: { textLength: 100, isLicensed: false },
    });

    expect(doc.languages).toEqual([]);
    expect(doc.titles).toEqual(["Needs repair"]);
  });

  test("preserves language-neutral Units while leaving preferred languages support-backed", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const doc = buildContentDocument({
      id: "image-essay-1",
      type: "MEDIA",
      defaultLanguage: "en",
      visibility: "PUBLIC",
      rating: "GENERAL",
      isLanguageNeutral: true,
      userId: "user-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: null,
      translations: [{ language: "en", title: "Visual essay", extra: null }],
      supportLanguages: [],
      unitTags: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      media: { isLicensed: false },
    });

    expect(doc.isLanguageNeutral).toBe(true);
    expect(doc.languages).toEqual([]);
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
        moderationStatus: "APPROVED",
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
        moderationStatus: "APPROVED",
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "DELETED",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
      }),
    ).toBe(true);
  });

  test("rejects globally removed content snapshots", async () => {
    setServerEnvForSearchTests();
    const { isPublicIndexableContentUnit, isPublicIndexablePostUnit } =
      await import("./sync");

    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "REMOVED",
      }),
    ).toBe(false);
    expect(
      isPublicIndexablePostUnit({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "REMOVED",
      }),
    ).toBe(false);
    expect(
      isPublicIndexablePostUnit({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
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
        moderationStatus: "APPROVED",
        catalogEntryKind: "VARIANT",
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
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
        moderationStatus: "APPROVED",
      }),
    ).toBe(true);
    expect(
      isPublicIndexablePostUnit({
        status: "PUBLISHED",
        visibility: "PRIVATE",
        moderationStatus: "APPROVED",
      }),
    ).toBe(false);
    expect(
      isPublicIndexablePostUnit({
        status: "DELETED",
        visibility: "PUBLIC",
        moderationStatus: "APPROVED",
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
        moderationStatus: "APPROVED",
      }),
    ).toBe(false);
    expect(
      isPublicIndexableContentUnit({
        type: "POST",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        moderationStatus: "REMOVED",
      }),
    ).toBe(false);
  });
});

describe("search sync global moderation projection", () => {
  test("syncSingleContent reads content graph through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSingleContent } = await import("./sync");
    const addOrUpdateContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([[contentUnitRow], ...contentHydrationRows()]) as never,
    );

    await syncSingleContent(
      { addOrUpdateContent, deleteContent } as any,
      "book-1",
    );

    expect(addOrUpdateContent).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "book-1",
        titles: ["Drizzle Book"],
        descriptions: ["Book description"],
        aliasValues: ["Alias"],
        tagIds: ["tag-1"],
        realmIds: ["realm-1"],
        realmTagKeys: ["realm-1:tag-1"],
        creditNames: ["Alice"],
        subjectNames: ["Topic"],
        textLength: 123,
        isLicensed: true,
      }),
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("syncContentSegment returns cursor from Drizzle rows", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncContentSegment } = await import("./sync");
    const addOrUpdateContent = mock(async (_docs: any[]) => undefined);
    setSearchDb(
      createDb([
        [contentUnitRow, { ...contentUnitRow, id: "book-2" }],
        ...contentHydrationRows(),
      ]) as never,
    );

    const result = await syncContentSegment({ addOrUpdateContent } as any, {
      limit: 1,
    });

    expect(result).toEqual({ processed: 1, nextCursor: "book-1" });
    expect(addOrUpdateContent).toHaveBeenCalledTimes(1);
  });

  test("syncSingleContent deletes globally removed content", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSingleContent } = await import("./sync");
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const addOrUpdateContent = mock(async (_docs: any[]) => undefined);

    setSearchDb(
      createDb([
        [
          {
            ...contentUnitRow,
            moderationStatus: "REMOVED",
          },
        ],
      ]) as never,
    );

    await syncSingleContent(
      { deleteContent, addOrUpdateContent } as any,
      "book-1",
    );

    expect(deleteContent).toHaveBeenCalledWith(["book-1"]);
    expect(addOrUpdateContent).not.toHaveBeenCalled();
  });

  test("syncSinglePost reads post graph through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSinglePost } = await import("./sync");
    const deletePosts = mock(async (_ids: string[]) => undefined);
    const addOrUpdatePosts = mock(async (_docs: any[]) => undefined);
    setSearchDb(createDb([[postBaseRow], ...postHydrationRows()]) as never);

    await syncSinglePost({ deletePosts, addOrUpdatePosts } as any, "post-1");

    expect(addOrUpdatePosts).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "post-1",
        titleText: "Post title",
        contentText: "Post body",
        authorName: "Alice",
        authorSlug: "alice",
        targetTitles: ["Target book"],
        scoreValue: 5,
        realmIds: ["realm-1"],
        languages: ["en"],
      }),
    ]);
    expect(deletePosts).not.toHaveBeenCalled();
  });

  test("syncPostsByAuthorSegment returns cursor from Drizzle rows", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncPostsByAuthorSegment } = await import("./sync");
    const addOrUpdatePosts = mock(async (_docs: any[]) => undefined);
    setSearchDb(
      createDb([
        [postBaseRow, { ...postBaseRow, unitId: "post-2" }],
        ...postHydrationRows(),
      ]) as never,
    );

    const result = await syncPostsByAuthorSegment(
      { addOrUpdatePosts } as any,
      "user-1",
      { limit: 1 },
    );

    expect(result).toEqual({ processed: 1, nextCursor: "post-1" });
    expect(addOrUpdatePosts).toHaveBeenCalledTimes(1);
  });

  test("syncSinglePost deletes globally removed posts", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSinglePost } = await import("./sync");
    const deletePosts = mock(async (_ids: string[]) => undefined);
    const addOrUpdatePosts = mock(async (_docs: any[]) => undefined);

    setSearchDb(
      createDb([
        [
          {
            ...postBaseRow,
            unitModerationStatus: "REMOVED",
          },
        ],
      ]) as never,
    );

    await syncSinglePost({ deletePosts, addOrUpdatePosts } as any, "post-1");

    expect(deletePosts).toHaveBeenCalledWith(["post-1"]);
    expect(addOrUpdatePosts).not.toHaveBeenCalled();
  });

  test("realm id patches exclude hidden UnitRealm rows while keeping locked rows", async () => {
    setServerEnvForSearchTests();
    const { patchContentRealmIds, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([
        [
          {
            type: "BOOK",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            moderationStatus: "APPROVED",
            catalogEntryKind: null,
          },
        ],
        [
          {
            realmUnitId: "realm-a",
            moderationStatus: "APPROVED",
            isLocked: true,
            realmIsPublic: true,
          },
          {
            realmUnitId: "realm-private",
            moderationStatus: "APPROVED",
            realmIsPublic: false,
          },
        ],
        [
          {
            type: "BOOK",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            moderationStatus: "APPROVED",
            catalogEntryKind: null,
          },
        ],
      ]) as never,
    );

    await patchContentRealmIds(
      { patchContent, deleteContent } as any,
      "post-1",
    );

    expect(patchContent).toHaveBeenCalledWith([
      { id: "post-1", realmIds: ["realm-a"] },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("realm id patches delete content when Unit is no longer indexable", async () => {
    setServerEnvForSearchTests();
    const { patchContentRealmIds, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([
        [
          {
            type: "BOOK",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            moderationStatus: "REMOVED",
            catalogEntryKind: null,
          },
        ],
      ]) as never,
    );

    await patchContentRealmIds(
      { patchContent, deleteContent } as any,
      "post-1",
    );

    expect(deleteContent).toHaveBeenCalledWith(["post-1"]);
    expect(patchContent).not.toHaveBeenCalled();
  });

  test("alias patches read visible aliases through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchContentAliases, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const eligibleUnit = {
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      catalogEntryKind: null,
    };
    setSearchDb(
      createDb([
        [eligibleUnit],
        [
          { value: "Pinned title", score: 0, pinned: true, status: "ACTIVE" },
          {
            value: "Popular title",
            score: 12,
            pinned: false,
            status: "ACTIVE",
          },
        ],
        [eligibleUnit],
      ]) as never,
    );

    await patchContentAliases({ patchContent, deleteContent } as any, "book-1");

    expect(patchContent).toHaveBeenCalledWith([
      { id: "book-1", aliasValues: ["Pinned title", "Popular title"] },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("tag patches read UnitTag labels through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchContentTags, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const eligibleUnit = {
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      catalogEntryKind: null,
    };
    setSearchDb(
      createDb([
        [eligibleUnit],
        [
          { tagUnitId: "tag-a", score: 12, title: "Science fiction" },
          { tagUnitId: "tag-a", score: 12, title: "SF" },
          { tagUnitId: "tag-b", score: 3, title: "Adventure" },
        ],
        [eligibleUnit],
      ]) as never,
    );

    await patchContentTags({ patchContent, deleteContent } as any, "book-1");

    expect(patchContent).toHaveBeenCalledWith([
      {
        id: "book-1",
        tagIds: ["tag-a", "tag-b"],
        tagScores: { "tag-a": 12, "tag-b": 3 },
        tagLabels: ["Science fiction", "SF", "Adventure"],
      },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("credit patches read attribution names through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchContentCredits, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const eligibleUnit = {
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      catalogEntryKind: null,
    };
    setSearchDb(
      createDb([
        [eligibleUnit],
        [
          { entityId: "person-a", role: "author", title: "Alice" },
          { entityId: "person-a", role: "author", title: "Alice JP" },
          { entityId: "person-b", role: "illustrator", title: "Bob" },
        ],
        [eligibleUnit],
      ]) as never,
    );

    await patchContentCredits({ patchContent, deleteContent } as any, "book-1");

    expect(patchContent).toHaveBeenCalledWith([
      { id: "book-1", creditNames: ["Alice", "Bob"] },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("subject patches read attribution names, kinds, and roles through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchContentSubjects, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const eligibleUnit = {
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      catalogEntryKind: null,
    };
    setSearchDb(
      createDb([
        [eligibleUnit],
        [
          {
            entityId: "character-a",
            role: "primary_character",
            kind: "character",
            title: "Aster",
          },
          {
            entityId: "character-a",
            role: "primary_character",
            kind: "character",
            title: "Aster JP",
          },
          {
            entityId: "place-a",
            role: "setting",
            kind: "place",
            title: "Moon City",
          },
        ],
        [eligibleUnit],
      ]) as never,
    );

    await patchContentSubjects(
      { patchContent, deleteContent } as any,
      "book-1",
    );

    expect(patchContent).toHaveBeenCalledWith([
      {
        id: "book-1",
        subjectEntityIds: ["character-a", "place-a"],
        subjectNames: ["Aster", "Aster JP", "Moon City"],
        subjectKinds: ["character", "place"],
        subjectRoles: ["primary_character", "setting"],
      },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("translation patches read translations and support languages through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchContentTranslations, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const eligibleUnit = {
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      catalogEntryKind: null,
    };
    setSearchDb(
      createDb([
        [eligibleUnit],
        [
          {
            language: "en",
            title: "English title",
            subtitle: "Subtitle",
            summary: "Summary",
            description: markdownContentDoc("Long description"),
          },
        ],
        [{ language: "en", isPrimary: true, sortOrder: 0 }],
        [eligibleUnit],
      ]) as never,
    );

    await patchContentTranslations(
      { patchContent, deleteContent } as any,
      "book-1",
    );

    expect(patchContent).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "book-1",
        titles: ["English title"],
        subtitles: ["Subtitle"],
        summaries: ["Summary"],
        descriptions: ["Long description"],
        descriptionText: "Long description",
        languages: ["en"],
      }),
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("contained unit patches read ShelfItem rows through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchContentContainedUnitIds, setSearchDb } = await import(
      "./sync"
    );
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const eligibleUnit = {
      type: "SHELF",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      catalogEntryKind: null,
    };
    setSearchDb(
      createDb([
        [eligibleUnit],
        [{ unitId: "book-a" }, { unitId: "book-b" }],
        [eligibleUnit],
      ]) as never,
    );

    await patchContentContainedUnitIds(
      { patchContent, deleteContent } as any,
      "shelf-1",
    );

    expect(patchContent).toHaveBeenCalledWith([
      { id: "shelf-1", containedUnitIds: ["book-a", "book-b"] },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("realm tag key patches read RealmTagApplication rows through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchContentRealmTagKeys, setSearchDb } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    const deleteContent = mock(async (_ids: string[]) => undefined);
    const eligibleUnit = {
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
      catalogEntryKind: null,
    };
    setSearchDb(
      createDb([
        [eligibleUnit],
        [
          { realmUnitId: "realm-a", tagUnitId: "tag-a" },
          { realmUnitId: "realm-b", tagUnitId: "tag-b" },
        ],
        [eligibleUnit],
      ]) as never,
    );

    await patchContentRealmTagKeys(
      { patchContent, deleteContent } as any,
      "book-1",
    );

    expect(patchContent).toHaveBeenCalledWith([
      {
        id: "book-1",
        realmTagKeys: ["realm-a:tag-a", "realm-b:tag-b"],
      },
    ]);
    expect(deleteContent).not.toHaveBeenCalled();
  });

  test("post author patches read public Post ids through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchPostsAuthor, setSearchDb } = await import("./sync");
    const patchPosts = mock(async (_docs: any[]) => undefined);
    setSearchDb(
      createDb([[{ unitId: "post-a" }, { unitId: "post-b" }], []]) as never,
    );

    await patchPostsAuthor({ patchPosts } as any, "user-1", {
      authorName: "Alice",
    });

    expect(patchPosts).toHaveBeenCalledWith([
      { id: "post-a", authorName: "Alice" },
      { id: "post-b", authorName: "Alice" },
    ]);
  });

  test("post target segment patches read target Unit and Post ids through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchPostsTargetSegment, setSearchDb } = await import("./sync");
    const patchPosts = mock(async (_docs: any[]) => undefined);
    setSearchDb(
      createDb([
        [{ id: "book-1", type: "BOOK", defaultLanguage: "en" }],
        [{ unitId: "book-1", language: "en", title: "Target book" }],
        [{ unitId: "post-a" }, { unitId: "post-b" }],
      ]) as never,
    );

    const result = await patchPostsTargetSegment(
      { patchPosts } as any,
      "book-1",
      { limit: 1 },
    );

    expect(result).toEqual({ processed: 1, nextCursor: "post-a" });
    expect(patchPosts).toHaveBeenCalledWith([
      {
        id: "post-a",
        targetTitles: ["Target book"],
        targetType: "BOOK",
        targetCoverUrl: null,
      },
    ]);
  });

  test("post field patches delete stale posts and normalize content through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchPostFields, setSearchDb } = await import("./sync");
    const patchPosts = mock(async (_docs: any[]) => undefined);
    const deletePosts = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([
        [
          {
            unitId: "post-1",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            moderationStatus: "APPROVED",
          },
        ],
        [
          {
            unitId: "post-removed",
            status: "PUBLISHED",
            visibility: "PUBLIC",
            moderationStatus: "REMOVED",
          },
        ],
      ]) as never,
    );

    await patchPostFields({ patchPosts, deletePosts } as any, "post-1", {
      content: markdownContentDoc("Updated body"),
    });
    await patchPostFields({ patchPosts, deletePosts } as any, "post-removed", {
      title: "Removed",
    });

    expect(patchPosts).toHaveBeenCalledWith([
      { id: "post-1", contentText: "Updated body" },
    ]);
    expect(deletePosts).toHaveBeenCalledWith(["post-removed"]);
  });

  test("post realm id segment patches read UnitRealm through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncPostRealmIdsSegment } = await import("./sync");
    const patchPosts = mock(async (_docs: any[]) => undefined);
    setSearchDb(
      createDb([
        [{ unitId: "post-1" }, { unitId: "post-2" }],
        [
          {
            unitId: "post-1",
            realmUnitId: "realm-public",
            moderationStatus: "APPROVED",
            isLocked: false,
            realm: { realm: { isPublic: true } },
          },
          {
            unitId: "post-1",
            realmUnitId: "realm-private",
            moderationStatus: "APPROVED",
            isLocked: false,
            realm: { realm: { isPublic: false } },
          },
        ],
      ]) as never,
    );

    const result = await syncPostRealmIdsSegment({ patchPosts } as any, {
      limit: 1,
    });

    expect(result).toEqual({ processed: 1, nextCursor: "post-1" });
    expect(patchPosts).toHaveBeenCalledWith([
      { id: "post-1", realmIds: ["realm-public"] },
    ]);
  });

  test("contained unit full sync reads ShelfItem rows through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncAllContainedUnitIds } = await import("./sync");
    const patchContent = mock(async (_docs: any[]) => undefined);
    setSearchDb(
      createDb([
        [{ id: "shelf-1" }],
        [
          { shelfId: "shelf-1", unitId: "book-a" },
          { shelfId: "shelf-1", unitId: "book-b" },
        ],
        [],
      ]) as never,
    );

    const result = await syncAllContainedUnitIds({ patchContent } as any);

    expect(result).toEqual({
      message: "syncAllContainedUnitIds success",
      totalSynced: 1,
    });
    expect(patchContent).toHaveBeenCalledWith([
      { id: "shelf-1", containedUnitIds: ["book-a", "book-b"] },
    ]);
  });
});
