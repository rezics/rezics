import { describe, expect, test } from "bun:test";

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

describe("ranking search projections", () => {
  test("content and post indexes expose ranking sortable attributes", async () => {
    const { getExpectedMeiliIndexSchema } = await import("./schema");

    expect(getExpectedMeiliIndexSchema("content").sortableAttributes).toContain(
      "hotScore",
    );
    expect(getExpectedMeiliIndexSchema("posts").sortableAttributes).toContain(
      "commentHotScore",
    );
  });

  test("document builders emit numeric ranking defaults", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument, buildPostDocument } = await import("./sync");

    const content = buildContentDocument({
      id: "book-1",
      type: "BOOK",
      translations: [],
      aliases: [],
      unitTags: [],
      workMemberships: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      book: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      publishedAt: null,
      defaultLanguage: null,
    });
    const post = buildPostDocument({
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
      unit: { user: null, inRealms: [], workMemberships: [] },
      targetUnit: null,
      scoreEntry: null,
    });

    expect(content.hotScore).toBe(0);
    expect(content.rankUpdatedAt).toBeNull();
    expect(post.hotScore).toBe(0);
    expect(post.commentHotScore).toBe(0);
    expect(post.commentRankUpdatedAt).toBeNull();
  });
});
