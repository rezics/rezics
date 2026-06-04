import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  ProjectionUpsertInput,
  RankingRepository,
  ServingPatchStatusInput,
} from "./ranking.repository";

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
    async patchContent(docs: any[]) {
      patchCalls.push(
        ...docs.map((doc) => ({
          type: "content",
          unitId: doc.id,
          fields: Object.fromEntries(
            Object.entries(doc).filter(([key]) => key !== "id"),
          ),
        })),
      );
    }
    async deleteContent(ids: string[]) {
      patchCalls.push(
        ...ids.map((unitId) => ({ type: "content-delete", unitId })),
      );
    }
    async patchPosts(docs: any[]) {
      patchCalls.push(
        ...docs.map((doc) => ({
          type: "post",
          unitId: doc.id,
          fields: Object.fromEntries(
            Object.entries(doc).filter(([key]) => key !== "id"),
          ),
        })),
      );
    }
    async deletePosts(ids: string[]) {
      patchCalls.push(
        ...ids.map((unitId) => ({ type: "post-delete", unitId })),
      );
    }
    async patchComments(docs: any[]) {
      patchCalls.push(
        ...docs.map((doc) => ({
          type: "comment",
          unitId: doc.id,
          fields: Object.fromEntries(
            Object.entries(doc).filter(([key]) => key !== "id"),
          ),
        })),
      );
    }
  },
}));

afterAll(() => {
  mock.restore();
});

mock.module("./main-state", () => ({
  MainStateReader: class {
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

class FakeRankingRepository implements RankingRepository {
  async ping() {}

  async findProjectionsByUnit() {
    return [];
  }

  async upsertProjection(input: ProjectionUpsertInput) {
    projectionUpserts.push(input);
    return {
      id: "projection-1",
      unitId: input.unitId,
      scopeKind: input.scopeKind,
      scopeId: input.scopeId,
      scopeKey: input.scopeKey,
      rankKind: input.rankKind,
      hotScore: input.hotScore,
      topScore: input.topScore,
      trendingScore: input.trendingScore,
      qualityScore: input.qualityScore,
      formulaVersion: input.formulaVersion,
      signalSnapshot: input.signalSnapshot,
      computedAt: input.computedAt,
      rankUpdatedAt: input.rankUpdatedAt,
      createdAt: input.computedAt,
      updatedAt: input.computedAt,
    };
  }

  async upsertSignalBucket(
    input: Parameters<RankingRepository["upsertSignalBucket"]>[0],
  ) {
    const now = new Date();
    return {
      id: "bucket-1",
      unitId: input.unitId,
      signalKind: input.signalKind,
      bucketStart: input.bucketStart,
      bucketEnd: input.bucketEnd,
      count: input.count,
      metadata: input.metadata ?? null,
      flushedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async readBucketSignals() {
    return { views: 0, reads: 0 };
  }

  async findProjectionsForPatch() {
    return [];
  }

  async createServingPatchStatus(input: ServingPatchStatusInput) {
    patchStatusCreates.push(input);
    return {
      id: "patch-1",
      projectionId: input.projectionId,
      unitId: input.unitId,
      indexName: input.indexName,
      documentId: input.documentId,
      status: input.status,
      patchedAt: input.patchedAt ?? null,
      lastAttemptAt: input.lastAttemptAt ?? null,
      retryCount: input.retryCount ?? 0,
      lastError: input.lastError ?? null,
      source: input.source ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async findFlushableBuckets() {
    return [];
  }

  async markBucketsFlushed() {}

  async disconnect() {}
}

describe("RankingService", () => {
  beforeEach(() => {
    patchCalls.length = 0;
    patchStatusCreates.length = 0;
    projectionUpserts.length = 0;
    stateOverrides.clear();
  });

  test("recomputes, stores, and patches a content projection", async () => {
    const { RankingService } = await import("./service");
    const service = new RankingService({
      repository: new FakeRankingRepository(),
    });

    const result = await service.recomputeUnit("unit-1", {
      rankKind: "content",
      source: { type: "manual" },
    });

    expect(result).toEqual({ unitId: "unit-1", projections: 1 });
    expect(projectionUpserts).toHaveLength(1);
    expect(patchCalls).toMatchObject([{ type: "content", unitId: "unit-1" }]);
    expect(patchStatusCreates[0]).toMatchObject({
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
        parentCommentId: null,
        replyCount: 2,
        directReplyCount: 1,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });

    const { RankingService } = await import("./service");
    const service = new RankingService({
      repository: new FakeRankingRepository(),
    });

    const result = await service.recomputeUnit("comment-1");

    expect(result).toEqual({ unitId: "comment-1", projections: 1 });
    expect(projectionUpserts[0]).toMatchObject({
      unitId: "comment-1",
      rankKind: "comment",
      scopeKind: "parent",
      scopeId: "post-1",
    });
    expect(projectionUpserts[0].signalSnapshot).toMatchObject({
      rankKind: "comment",
      scope: { kind: "parent", id: "post-1" },
      replyCount: 2,
      directReplyCount: 1,
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    expect(patchCalls).toMatchObject([
      {
        type: "comment",
        unitId: "comment-1",
        fields: {
          hotScore: expect.any(Number),
          topScore: expect.any(Number),
          qualityScore: expect.any(Number),
          rankUpdatedAt: expect.any(String),
        },
      },
    ]);
    expect(patchStatusCreates[0]).toMatchObject({
      unitId: "comment-1",
      indexName: "comments",
      status: "patched",
    });
  });
});
