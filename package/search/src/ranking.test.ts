import { describe, expect, mock, test } from "bun:test";

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
    expect(
      getExpectedMeiliIndexSchema("comments").sortableAttributes,
    ).toContain("hotScore");
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

  test("comment ranking patches land in the comments index", async () => {
    setServerEnvForSearchTests();
    const { patchCommentRankingFields } = await import("./sync");
    const patchComments = mock(async (_docs: unknown[]) => undefined);
    const patchPosts = mock(async (_docs: unknown[]) => undefined);

    await patchCommentRankingFields(
      { patchComments, patchPosts } as never,
      "comment-1",
      {
        hotScore: 10,
        topScore: 7,
        qualityScore: 5,
        rankUpdatedAt: "2026-01-01T00:00:00.000Z",
      },
    );

    expect(patchComments).toHaveBeenCalledWith([
      {
        id: "comment-1",
        hotScore: 10,
        topScore: 7,
        qualityScore: 5,
        rankUpdatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(patchPosts).not.toHaveBeenCalled();
  });

  test("content document builder projects GAME and MEDIA metadata", async () => {
    setServerEnvForSearchTests();
    const { buildContentDocument } = await import("./sync");

    const game = buildContentDocument({
      id: "game-1",
      type: "GAME",
      translations: [],
      aliases: [],
      unitTags: [
        {
          tagUnitId: "tag-esrb-teen",
          score: 0,
          pinned: true,
          tag: { slug: "esrb-teen", translations: [] },
        },
      ],
      workMemberships: [{ role: "RELEASE", workUnitId: "work-1" }],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [
        { role: "available_on", entityId: "platform-windows" },
        { role: "setting", entityId: "universe-1" },
      ],
      game: {
        releaseDate: new Date("2024-03-15T00:00:00.000Z"),
        versionLabel: "Definitive Edition",
        systemRequirements: [
          {
            platformEntityId: "platform-windows",
            tier: "minimum",
            language: "en",
            hardware: { cpuSlugs: ["cpu:intel-core-i5"] },
          },
        ],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      publishedAt: null,
      defaultLanguage: null,
    });
    const media = buildContentDocument({
      id: "media-1",
      type: "MEDIA",
      translations: [],
      aliases: [],
      unitTags: [
        {
          tagUnitId: "tag-tv-14",
          score: 0,
          pinned: true,
          tag: { slug: "tv-14", translations: [] },
        },
      ],
      workMemberships: [],
      inRealms: [],
      realmTagApplicationsAsTargetUnit: [],
      creditAttributions: [],
      subjectAttributions: [],
      media: {
        kindKey: "movie",
        releaseDate: "2024-04-01T00:00:00.000Z",
        runtimeMinutes: 120,
        episodeCount: null,
        seasonCount: null,
      },
      ownedContentStructure: { ownerUnitId: "media-1" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      publishedAt: null,
      defaultLanguage: null,
    });

    expect(game.platformEntityIds).toEqual(["platform-windows"]);
    expect(game.ratingTagUnitIds).toEqual(["tag-esrb-teen"]);
    expect(game.gameReleaseDate).toBe("2024-03-15T00:00:00.000Z");
    expect(game.gameVersionLabel).toBe("Definitive Edition");
    expect(game.gameSystemRequirementSummaries).toEqual([
      {
        platformEntityId: "platform-windows",
        tier: "minimum",
        language: "en",
        hardware: { cpuSlugs: ["cpu:intel-core-i5"] },
      },
    ]);
    expect(media.ratingTagUnitIds).toEqual(["tag-tv-14"]);
    expect(media.mediaKindKey).toBe("movie");
    expect(media.mediaReleaseDate).toBe("2024-04-01T00:00:00.000Z");
    expect(media.mediaRuntimeMinutes).toBe(120);
    expect(media.mediaContentStructureAvailable).toBe(true);
  });

  test("GAME/MEDIA segment sync only rebuilds game and media documents", async () => {
    setServerEnvForSearchTests();
    const { setSearchPrismaClient, syncGameMediaContentSegment } = await import(
      "./sync"
    );
    const rows = [
      {
        id: "game-1",
        type: "GAME",
        translations: [],
        aliases: [],
        unitTags: [],
        workMemberships: [],
        inRealms: [],
        realmTagApplicationsAsTargetUnit: [],
        creditAttributions: [],
        subjectAttributions: [],
        game: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        publishedAt: null,
        defaultLanguage: null,
      },
      { id: "media-1", type: "MEDIA" },
    ];
    const findMany = mock(async () => rows);
    const addOrUpdateContent = mock(async (_docs: unknown[]) => undefined);
    setSearchPrismaClient({ unit: { findMany } } as never);

    const result = await syncGameMediaContentSegment(
      { addOrUpdateContent } as never,
      { limit: 1 },
    );

    const findManyArgs = (findMany as any).mock.calls[0]?.[0];
    expect(findManyArgs.where.type).toEqual({
      in: ["GAME", "MEDIA"],
    });
    expect(addOrUpdateContent.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: "game-1", type: "GAME" }),
    ]);
    expect(result).toEqual({ processed: 1, nextCursor: "game-1" });
  });
});
