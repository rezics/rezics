import { describe, expect, test } from "bun:test";
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
  test("includes realmIds from RealmUnit rows", async () => {
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
        inRealms: [{ realmUnitId: "realm-1" }, { realmUnitId: "realm-2" }],
      },
      targetUnit: null,
      scoreEntry: null,
      extra: null,
    });

    expect(doc.realmIds).toEqual(["realm-1", "realm-2"]);
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

  test("rejects private, deleted, and release Units", async () => {
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
});
