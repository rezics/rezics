import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.RANKING_DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/ranking";
process.env.SERVER_DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/server";
process.env.REACTION_BASE_URL ??= "http://reaction.example";
process.env.REACTION_INTERNAL_SECRET ??= "reaction-secret";
process.env.MEILI_HOST ??= "http://meili.example";
process.env.MEILI_MASTER_KEY ??= "masterKey";

const patchCalls: any[] = [];
const patchStatusCreates: any[] = [];
const projectionUpserts: any[] = [];
const stateOverrides = new Map<string, any>();

function defaultUnitState(unitId: string) {
  return {
    unit: {
      id: unitId,
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    post: null,
    comment: null,
    scoreAggregate: { totalScore: 10, totalCount: 2 },
    progressCount: 4,
    realms: [],
  };
}

mock.module("@rezics/search", () => ({
  SearchClient: class {
    async checkHealth() {
      return true;
    }
  },
  setSearchPrismaClient: () => {},
  patchContentRankingFields: async (
    _client: unknown,
    unitId: string,
    fields: any,
  ) => {
    patchCalls.push({ type: "content", unitId, fields });
  },
  patchPostRankingFields: async (
    _client: unknown,
    unitId: string,
    fields: any,
  ) => {
    patchCalls.push({ type: "post", unitId, fields });
  },
  patchCommentRankingFields: async (
    _client: unknown,
    unitId: string,
    fields: any,
  ) => {
    patchCalls.push({ type: "comment", unitId, fields });
  },
}));

mock.module("#/prisma/client", () => ({
  prisma: {
    unitRankProjection: {
      upsert: async (args: any) => {
        projectionUpserts.push(args);
        return {
          id: "projection-1",
          unitId: args.create.unitId,
          rankKind: args.create.rankKind,
          hotScore: args.create.hotScore,
          topScore: args.create.topScore,
          trendingScore: args.create.trendingScore,
          qualityScore: args.create.qualityScore,
          formulaVersion: args.create.formulaVersion,
          computedAt: args.create.computedAt,
          rankUpdatedAt: args.create.rankUpdatedAt,
        };
      },
      findMany: async () => [],
    },
    servingPatchStatus: {
      create: async (args: any) => {
        patchStatusCreates.push(args);
        return args.data;
      },
    },
    rankingSignalBucket: {
      groupBy: async () => [],
    },
    $queryRaw: async () => [{ "?column?": 1 }],
    $disconnect: async () => {},
  },
}));

mock.module("./main-state", () => ({
  MainStateReader: class {
    prisma = {};

    async readUnitState(unitId: string) {
      return stateOverrides.get(unitId) ?? defaultUnitState(unitId);
    }

    async fullSyncSegment() {
      return { unitIds: [], nextCursor: undefined };
    }

    async disconnect() {}
  },
}));

mock.module("./reaction-client", () => ({
  ReactionSummaryClient: class {
    async getSummaries() {
      return { "unit-1": { like: 3 } };
    }
  },
}));

describe("RankingService", () => {
  beforeEach(() => {
    patchCalls.length = 0;
    patchStatusCreates.length = 0;
    projectionUpserts.length = 0;
    stateOverrides.clear();
  });

  test("recomputes, stores, and patches a content projection", async () => {
    const { RankingService } = await import("./service");
    const service = new RankingService();

    const result = await service.recomputeUnit("unit-1", {
      rankKind: "content",
      source: { type: "manual" },
    });

    expect(result).toEqual({ unitId: "unit-1", projections: 1 });
    expect(projectionUpserts).toHaveLength(1);
    expect(patchCalls).toMatchObject([{ type: "content", unitId: "unit-1" }]);
    expect(patchStatusCreates[0].data).toMatchObject({
      unitId: "unit-1",
      indexName: "content",
      status: "patched",
    });
  });

  test("derives comment ranking from Comment state and patches comments index", async () => {
    stateOverrides.set("comment-1", {
      ...defaultUnitState("comment-1"),
      unit: {
        ...defaultUnitState("comment-1").unit,
        type: "COMMENT",
      },
      comment: {
        unitId: "comment-1",
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentUnitId: null,
        replyCount: 2,
        directReplyCount: 1,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });

    const { RankingService } = await import("./service");
    const service = new RankingService();

    const result = await service.recomputeUnit("comment-1");

    expect(result).toEqual({ unitId: "comment-1", projections: 1 });
    expect(projectionUpserts[0].create).toMatchObject({
      unitId: "comment-1",
      rankKind: "comment",
      scopeKind: "parent",
      scopeId: "post-1",
    });
    expect(projectionUpserts[0].create.signalSnapshot).toMatchObject({
      rankKind: "comment",
      scope: { kind: "parent", id: "post-1" },
      replyCount: 2,
      directReplyCount: 1,
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    expect(patchCalls).toMatchObject([
      { type: "comment", unitId: "comment-1" },
    ]);
    expect(patchStatusCreates[0].data).toMatchObject({
      unitId: "comment-1",
      indexName: "comments",
      status: "patched",
    });
  });
});
