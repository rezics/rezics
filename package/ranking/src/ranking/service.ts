import {
  createRankingCommand,
  RANKING_COMMAND_KINDS,
  type RankingCommand,
} from "@rezics/job";
import {
  patchCommentRankingFields,
  patchContentRankingFields,
  patchPostRankingFields,
  SearchClient,
  setSearchPrismaClient,
} from "@rezics/search";
import { prisma } from "#/prisma/client";
import { env } from "../env";
import { computeV1RankingScores, RANKING_FORMULA_VERSION } from "./formulas";
import { MainStateReader } from "./main-state";
import { ReactionSummaryClient } from "./reaction-client";
import {
  type RankingScope,
  type RankingSignalSnapshot,
  type RankKind,
  scopeKey,
} from "./types";

const DEFAULT_SCOPE: RankingScope = { kind: "global" };
const DEFAULT_FULL_SYNC_LIMIT = 100;

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rankKindsForState(
  state: Awaited<ReturnType<MainStateReader["readUnitState"]>>,
): RankKind[] {
  const kinds: RankKind[] = [];
  if (state.unit && state.unit.type !== "COMMENT") kinds.push("content");
  if (state.post) {
    kinds.push("post");
  }
  if (state.comment) kinds.push("comment");
  return kinds;
}

function scopesForRankKind(
  rankKind: RankKind,
  state: Awaited<ReturnType<MainStateReader["readUnitState"]>>,
  requested?: RankingScope,
): RankingScope[] {
  if (requested) return [requested];
  if (rankKind === "comment") {
    const parentId =
      state.comment?.parentCommentUnitId ?? state.comment?.rootUnitId;
    return parentId ? [{ kind: "parent", id: parentId }] : [];
  }
  if (rankKind === "post" && state.realms.length > 0) {
    return [
      DEFAULT_SCOPE,
      ...state.realms.map((realmId) => ({
        kind: "realm" as const,
        id: realmId,
      })),
    ];
  }
  return [DEFAULT_SCOPE];
}

export class RankingService {
  private readonly mainState = new MainStateReader({
    serverDatabaseUrl: env.SERVER_DATABASE_URL,
  });
  private readonly reactions = new ReactionSummaryClient({
    baseUrl: env.REACTION_BASE_URL,
    internalSecret: env.REACTION_INTERNAL_SECRET,
  });
  private readonly search = new SearchClient({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });

  constructor() {
    setSearchPrismaClient(this.mainState.prisma);
  }

  async ready() {
    await prisma.$queryRaw`SELECT 1`;
    const meiliAvailable = await this.search.checkHealth();
    return { status: meiliAvailable ? "ok" : "degraded", meiliAvailable };
  }

  async inspectUnit(unitId: string) {
    const projections = await prisma.unitRankProjection.findMany({
      where: { unitId },
      orderBy: [{ rankKind: "asc" }, { scopeKind: "asc" }],
    });
    return { unitId, projections };
  }

  async handleCommand(command: RankingCommand): Promise<unknown> {
    console.log("[ranking] command", {
      kind: command.kind,
      idempotencyKey: command.idempotencyKey,
      source: command.source,
    });

    switch (command.kind) {
      case RANKING_COMMAND_KINDS.invalidate:
      case RANKING_COMMAND_KINDS.recompute:
        return this.recomputeUnit(command.payload.unitId, {
          scope: command.payload.scope,
          rankKind: command.payload.rankKind,
          source: command.source,
        });
      case RANKING_COMMAND_KINDS.patchServing:
        return this.patchServing(command.payload);
      case RANKING_COMMAND_KINDS.fullSync:
        return this.fullSyncSegment(command.payload);
      case RANKING_COMMAND_KINDS.viewBucketFlush:
        return this.flushViewBuckets(command.payload);
    }
  }

  async recomputeUnit(
    unitId: string,
    options: {
      scope?: RankingScope;
      rankKind?: RankKind;
      source?: RankingCommand["source"];
    } = {},
  ) {
    const state = await this.mainState.readUnitState(unitId);
    if (!state.unit) return { unitId, skipped: "unit-not-found" };

    const reactionSummaries = await this.reactions.getSummaries([unitId]);
    const bucketSignals = await this.readBucketSignals(unitId);
    const rankKinds = options.rankKind
      ? [options.rankKind]
      : rankKindsForState(state);
    const projections = [];

    for (const rankKind of rankKinds) {
      for (const scope of scopesForRankKind(rankKind, state, options.scope)) {
        const snapshot: RankingSignalSnapshot = {
          unitId,
          rankKind,
          scope,
          publishedAt: toIso(state.unit.publishedAt),
          createdAt: toIso(
            rankKind === "post" || rankKind === "comment"
              ? (rankKind === "comment" ? state.comment : state.post)?.createdAt
              : state.unit.createdAt,
          ),
          replyCount: toNumber(
            rankKind === "comment"
              ? state.comment?.replyCount
              : state.post?.replyCount,
          ),
          directReplyCount: toNumber(
            rankKind === "comment"
              ? state.comment?.directReplyCount
              : state.post?.directReplyCount,
          ),
          scoreTotal: toNumber(state.scoreAggregate?.totalScore),
          scoreCount: toNumber(state.scoreAggregate?.totalCount),
          progressCount: state.progressCount,
          reactionCounts: reactionSummaries[unitId] ?? {},
          bucketSignals,
        };
        const scores = computeV1RankingScores(snapshot);
        const rankUpdatedAt = new Date();
        const projection = await prisma.unitRankProjection.upsert({
          where: {
            unitId_scopeKind_scopeKey_rankKind: {
              unitId,
              scopeKind: scope.kind,
              scopeKey: scopeKey(scope),
              rankKind,
            },
          },
          update: {
            ...scores,
            scopeId: scope.id ?? null,
            formulaVersion: RANKING_FORMULA_VERSION,
            signalSnapshot: snapshot as any,
            computedAt: rankUpdatedAt,
            rankUpdatedAt,
          },
          create: {
            unitId,
            scopeKind: scope.kind,
            scopeId: scope.id ?? null,
            scopeKey: scopeKey(scope),
            rankKind,
            ...scores,
            formulaVersion: RANKING_FORMULA_VERSION,
            signalSnapshot: snapshot as any,
            computedAt: rankUpdatedAt,
            rankUpdatedAt,
          },
        });
        projections.push(projection);
        await this.patchProjection(projection, options.source);
      }
    }

    return { unitId, projections: projections.length };
  }

  async ingestSignal(input: {
    unitId: string;
    signalKind: "view" | "read";
    at?: string;
    count?: number;
    metadata?: unknown;
  }) {
    const at = input.at ? new Date(input.at) : new Date();
    const bucketStart = new Date(at);
    bucketStart.setMinutes(0, 0, 0);
    const bucketEnd = new Date(bucketStart.getTime() + 3_600_000);
    const count = Math.max(input.count ?? 1, 1);

    const bucket = await prisma.rankingSignalBucket.upsert({
      where: {
        unitId_signalKind_bucketStart: {
          unitId: input.unitId,
          signalKind: input.signalKind,
          bucketStart,
        },
      },
      update: {
        count: { increment: count },
        bucketEnd,
        metadata: input.metadata as any,
      },
      create: {
        unitId: input.unitId,
        signalKind: input.signalKind,
        bucketStart,
        bucketEnd,
        count,
        metadata: input.metadata as any,
      },
    });

    return { bucket, patchedServing: false };
  }

  private async readBucketSignals(unitId: string) {
    const rows = await prisma.rankingSignalBucket.groupBy({
      by: ["signalKind"],
      where: { unitId },
      _sum: { count: true },
    });
    return {
      views: rows.find((row) => row.signalKind === "view")?._sum.count ?? 0,
      reads: rows.find((row) => row.signalKind === "read")?._sum.count ?? 0,
    };
  }

  private async patchServing(payload: {
    unitId?: string;
    projectionId?: string;
    rankKind?: RankKind;
    limit?: number;
  }) {
    const projections = await prisma.unitRankProjection.findMany({
      where: {
        ...(payload.projectionId ? { id: payload.projectionId } : {}),
        ...(payload.unitId ? { unitId: payload.unitId } : {}),
        ...(payload.rankKind ? { rankKind: payload.rankKind } : {}),
      },
      orderBy: { computedAt: "asc" },
      take: Math.min(payload.limit ?? 100, 500),
    });

    for (const projection of projections) {
      await this.patchProjection(projection, { type: "manual" });
    }

    return { patched: projections.length };
  }

  private async patchProjection(
    projection: any,
    source: RankingCommand["source"] | undefined,
  ) {
    const rankUpdatedAt = toIso(
      projection.rankUpdatedAt ?? projection.computedAt,
    );
    try {
      if (projection.rankKind === "content") {
        await patchContentRankingFields(this.search, projection.unitId, {
          hotScore: projection.hotScore,
          topScore: projection.topScore,
          trendingScore: projection.trendingScore,
          qualityScore: projection.qualityScore,
          rankUpdatedAt,
        });
      } else if (projection.rankKind === "post") {
        await patchPostRankingFields(this.search, projection.unitId, {
          hotScore: projection.hotScore,
          topScore: projection.topScore,
          trendingScore: projection.trendingScore,
          qualityScore: projection.qualityScore,
          rankUpdatedAt,
        });
      } else {
        await patchCommentRankingFields(this.search, projection.unitId, {
          hotScore: projection.hotScore,
          topScore: projection.topScore,
          qualityScore: projection.qualityScore,
          rankUpdatedAt,
        });
      }

      await prisma.servingPatchStatus.create({
        data: {
          projectionId: projection.id,
          unitId: projection.unitId,
          indexName:
            projection.rankKind === "content"
              ? "content"
              : projection.rankKind === "comment"
                ? "comments"
                : "posts",
          documentId: projection.unitId,
          status: "patched",
          patchedAt: new Date(),
          lastAttemptAt: new Date(),
          source: source ? (source as any) : undefined,
        },
      });
      console.log("[ranking] patched serving", {
        unitId: projection.unitId,
        rankKind: projection.rankKind,
        formulaVersion: projection.formulaVersion,
      });
    } catch (error) {
      await prisma.servingPatchStatus.create({
        data: {
          projectionId: projection.id,
          unitId: projection.unitId,
          indexName:
            projection.rankKind === "content"
              ? "content"
              : projection.rankKind === "comment"
                ? "comments"
                : "posts",
          documentId: projection.unitId,
          status: "failed",
          lastAttemptAt: new Date(),
          retryCount: 1,
          lastError: error instanceof Error ? error.message : String(error),
          source: source ? (source as any) : undefined,
        },
      });
      throw error;
    }
  }

  private async fullSyncSegment(payload: {
    cursor?: string;
    limit?: number;
    rankKind?: RankKind;
  }) {
    const limit = Math.min(
      Math.max(
        payload.limit ??
          Number(env.RANKING_FULL_SYNC_LIMIT ?? DEFAULT_FULL_SYNC_LIMIT),
        1,
      ),
      500,
    );
    const segment = await this.mainState.fullSyncSegment(payload.cursor, limit);

    for (const unitId of segment.unitIds) {
      await this.recomputeUnit(unitId, {
        rankKind: payload.rankKind,
        source: { type: "maintenance", reason: "ranking.fullSync" },
      });
    }

    return {
      processed: segment.unitIds.length,
      nextCursor: segment.nextCursor,
      continuation: segment.nextCursor
        ? createRankingCommand(RANKING_COMMAND_KINDS.fullSync, {
            cursor: segment.nextCursor,
            limit,
            rankKind: payload.rankKind,
          })
        : undefined,
    };
  }

  private async flushViewBuckets(payload: {
    cursor?: string;
    limit?: number;
    bucketBefore?: string;
  }) {
    const limit = Math.min(Math.max(payload.limit ?? 100, 1), 500);
    const bucketBefore = payload.bucketBefore
      ? new Date(payload.bucketBefore)
      : new Date();
    const rows = await prisma.rankingSignalBucket.findMany({
      where: {
        flushedAt: null,
        bucketEnd: { lte: bucketBefore },
      },
      orderBy: [{ unitId: "asc" }, { bucketStart: "asc" }],
      take: limit + 1,
      skip: payload.cursor ? 1 : 0,
      cursor: payload.cursor ? { id: payload.cursor } : undefined,
    });
    const current = rows.slice(0, limit);
    const unitIds = [...new Set(current.map((row) => row.unitId))];
    for (const unitId of unitIds) {
      await this.recomputeUnit(unitId, {
        source: { type: "maintenance", reason: "ranking.viewBucketFlush" },
      });
    }
    if (current.length > 0) {
      await prisma.rankingSignalBucket.updateMany({
        where: { id: { in: current.map((row) => row.id) } },
        data: { flushedAt: new Date() },
      });
    }
    const last = current.at(-1);
    return {
      flushed: current.length,
      recomputed: unitIds.length,
      nextCursor: rows.length > limit && last ? last.id : undefined,
    };
  }

  async disconnect() {
    await this.mainState.disconnect();
    await prisma.$disconnect();
  }
}

export const rankingService = new RankingService();
