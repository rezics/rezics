import { describe, expect, test } from "bun:test";

describe("buildPostDocument", () => {
  test("includes realmIds from RealmUnit rows", async () => {
    process.env.DATABASE_URL ??=
      "postgresql://postgres:postgres@localhost:5432/rezics_book";
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      body: "hello",
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
    process.env.DATABASE_URL ??=
      "postgresql://postgres:postgres@localhost:5432/rezics_book";
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      body: "hello",
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
    process.env.DATABASE_URL ??=
      "postgresql://postgres:postgres@localhost:5432/rezics_book";
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-2",
      body: null,
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
    process.env.DATABASE_URL ??=
      "postgresql://postgres:postgres@localhost:5432/rezics_book";
    const { buildPostDocument } = await import("./sync");
    const doc = buildPostDocument({
      unitId: "post-1",
      body: null,
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
});

describe("buildContentDocument realm tag keys", () => {
  test("realmTagKeys can exist without matching realmIds", async () => {
    process.env.DATABASE_URL ??=
      "postgresql://postgres:postgres@localhost:5432/rezics_book";
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
      attributions: [],
      book: { textLength: 100, isLicensed: false },
    });

    expect(doc.realmIds).toEqual([]);
    expect(doc.realmTagKeys).toEqual(["realm-1:tag-1"]);
  });
});
