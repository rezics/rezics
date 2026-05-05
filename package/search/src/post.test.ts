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
