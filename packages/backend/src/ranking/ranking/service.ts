import {
  createRankingCommand,
  RANKING_COMMAND_KINDS,
  type RankingCommand,
} from "@rezics/job";
import { SearchClient } from "@rezics/search";
import { env } from "../env";
import { computeV1RankingScores, RANKING_FORMULA_VERSION } from "./formulas";
import { MainStateReader } from "./main-state";
import {
  DrizzleRankingRepository,
  type RankingRepository,
} from "./ranking.repository";
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

function reactionContextForRankingScope(
  scope: RankingScope,
): string | null | undefined {
  // Ranking scopes are not interaction contexts. Only a realm ranking scope maps
  // to reaction.contextUnitId; global/work/tag/parent rankings read all-context
  // reaction aggregates.
  return scope.kind === "realm" ? (scope.id ?? null) : undefined;
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

function isPublicIndexableContentUnit(unit: any): boolean {
  return Boolean(
    unit &&
      unit.status === "PUBLISHED" &&
      unit.visibility === "PUBLIC" &&
      (unit.moderationStatus === "APPROVED" ||
        unit.moderationStatus === undefined) &&
      (unit.catalogEntryKind === null ||
        unit.catalogEntryKind === undefined ||
        unit.catalogEntryKind === "MAIN"),
  );
}

function isPublicIndexablePostUnit(unit: any): boolean {
  return Boolean(
    unit &&
      unit.status === "PUBLISHED" &&
      unit.visibility === "PUBLIC" &&
      (unit.moderationStatus === "APPROVED" ||
        unit.moderationStatus === undefined),
  );
}

function scopesForRankKind(
  rankKind: RankKind,
  state: Awaited<ReturnType<MainStateReader["readUnitState"]>>,
  requested?: RankingScope,
): RankingScope[] {
  if (requested) return [requested];
  if (rankKind === "comment") {
    const parentId =
      state.comment?.parentCommentId ?? state.comment?.rootUnitId;
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
  private readonly mainState: MainStateReader;
  private readonly reactions: ReactionSummaryClient;
  private readonly search: SearchClient;
  private readonly repository: RankingRepository;

  constructor(
    options: {
      mainState?: MainStateReader;
      reactions?: ReactionSummaryClient;
      search?: SearchClient;
      repository?: RankingRepository;
    } = {},
  ) {
    this.mainState =
      options.mainState ??
      new MainStateReader({
        serverDatabaseUrl: env.SERVER_DATABASE_URL,
      });
    this.reactions =
      options.reactions ??
      new ReactionSummaryClient({
        baseUrl: env.REACTION_BASE_URL,
        internalSecret: env.REACTION_INTERNAL_SECRET,
      });
    this.search =
      options.search ??
      new SearchClient({
        host: env.MEILI_HOST,
        apiKey: env.MEILI_MASTER_KEY,
      });
    this.repository = options.repository ?? new DrizzleRankingRepository();
  }

  async ready() {
    await this.repository.ping();
    const meiliAvailable = await this.search.checkHealth();
    return { status: meiliAvailable ? "ok" : "degraded", meiliAvailable };
  }

  async inspectUnit(unitId: string) {
    const projections = await this.repository.findProjectionsByUnit(unitId);
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
      case RANKING_COMMAND_KINDS.reactionBucket:
        return this.ingestReactionBucket(command.payload, command.source);
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
    if (!state.unit && !state.comment) {
      return { unitId, skipped: "unit-not-found" };
    }

    const reactionSummaries = await this.reactions.getSummaries([unitId]);
    const bucketSignals = await this.readBucketSignals(unitId);
    const computedAt = new Date();
    const rankKinds = options.rankKind
      ? [options.rankKind]
      : rankKindsForState(state);
    const projections = [];

    for (const rankKind of rankKinds) {
      for (const scope of scopesForRankKind(rankKind, state, options.scope)) {
        const scopeKeyValue = scopeKey(scope);
        const snapshot: RankingSignalSnapshot = {
          unitId,
          rankKind,
          scope,
          publishedAt: toIso(state.unit?.publishedAt),
          createdAt: toIso(
            rankKind === "post" || rankKind === "comment"
              ? (rankKind === "comment" ? state.comment : state.post)?.createdAt
              : state.unit?.createdAt,
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
          recentVoteCounts: await this.repository.readRecentVoteWindows(
            unitId,
            reactionContextForRankingScope(scope),
            computedAt,
          ),
          bucketSignals,
        };
        const scores = computeV1RankingScores(snapshot);
        const rankUpdatedAt = new Date();
        const projection = await this.repository.upsertProjection({
          unitId,
          scopeKind: scope.kind,
          scopeId: scope.id ?? null,
          scopeKey: scopeKeyValue,
          rankKind,
          ...scores,
          formulaVersion: RANKING_FORMULA_VERSION,
          signalSnapshot: snapshot,
          computedAt: rankUpdatedAt,
          rankUpdatedAt,
        });
        projections.push(projection);
        await this.patchProjection(projection, options.source, state);
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

    const bucket = await this.repository.upsertSignalBucket({
      unitId: input.unitId,
      signalKind: input.signalKind,
      bucketStart,
      bucketEnd,
      count,
      metadata: input.metadata,
    });

    return { bucket, patchedServing: false };
  }

  async ingestReactionBucket(
    input: {
      targetId: string;
      contextUnitId?: string | null;
      reaction: "upvote" | "downvote";
      count: number;
      at?: string;
    },
    source: RankingCommand["source"] = { type: "server" },
  ) {
    const at = input.at ? new Date(input.at) : new Date();
    const bucketStart = new Date(at);
    bucketStart.setMinutes(0, 0, 0);
    const bucketEnd = new Date(bucketStart.getTime() + 3_600_000);
    const count = Number.isFinite(input.count) ? input.count : 0;

    const bucket = await this.repository.upsertReactionBucket({
      targetId: input.targetId,
      contextUnitId: input.contextUnitId ?? null,
      reaction: input.reaction,
      bucketStart,
      bucketEnd,
      count,
    });

    const recompute = await this.recomputeUnit(input.targetId, {
      source,
    });

    return { bucket, recompute };
  }

  private async readBucketSignals(unitId: string) {
    return this.repository.readBucketSignals(unitId);
  }

  private async patchServing(payload: {
    unitId?: string;
    projectionId?: string;
    rankKind?: RankKind;
    limit?: number;
  }) {
    const projections = await this.repository.findProjectionsForPatch({
      projectionId: payload.projectionId,
      unitId: payload.unitId,
      rankKind: payload.rankKind,
      limit: Math.min(payload.limit ?? 100, 500),
    });

    for (const projection of projections) {
      await this.patchProjection(projection, { type: "manual" });
    }

    return { patched: projections.length };
  }

  private async patchProjection(
    projection: any,
    source: RankingCommand["source"] | undefined,
    state?: Awaited<ReturnType<MainStateReader["readUnitState"]>>,
  ) {
    const rankUpdatedAt = toIso(
      projection.rankUpdatedAt ?? projection.computedAt,
    );
    const rankingState =
      state ?? (await this.mainState.readUnitState(projection.unitId));
    try {
      if (projection.rankKind === "content") {
        if (!isPublicIndexableContentUnit(rankingState.unit)) {
          await this.search.deleteContent([projection.unitId]);
        } else {
          await this.search.patchContent([
            {
              id: projection.unitId,
              bestScore: projection.bestScore,
              hotScore: projection.hotScore,
              topScore: projection.topScore,
              risingScore: projection.risingScore,
              controversyScore: projection.controversyScore,
              trendingScore: projection.trendingScore,
              qualityScore: projection.qualityScore,
              rankUpdatedAt,
            },
          ]);
        }
      } else if (projection.rankKind === "post") {
        if (
          !rankingState.post ||
          !isPublicIndexablePostUnit(rankingState.unit)
        ) {
          await this.search.deletePosts([projection.unitId]);
        } else {
          await this.search.patchPosts([
            {
              id: projection.unitId,
              bestScore: projection.bestScore,
              hotScore: projection.hotScore,
              topScore: projection.topScore,
              risingScore: projection.risingScore,
              controversyScore: projection.controversyScore,
              trendingScore: projection.trendingScore,
              qualityScore: projection.qualityScore,
              rankUpdatedAt,
            },
          ]);
        }
      } else {
        await this.search.patchComments([
          {
            id: projection.unitId,
            bestScore: projection.bestScore,
            hotScore: projection.hotScore,
            topScore: projection.topScore,
            risingScore: projection.risingScore,
            controversyScore: projection.controversyScore,
            qualityScore: projection.qualityScore,
            rankUpdatedAt,
          },
        ]);
      }

      await this.repository.createServingPatchStatus({
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
        source,
      });
      console.log("[ranking] patched serving", {
        unitId: projection.unitId,
        rankKind: projection.rankKind,
        formulaVersion: projection.formulaVersion,
      });
    } catch (error) {
      await this.repository.createServingPatchStatus({
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
        source,
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
    const rows = await this.repository.findFlushableBuckets({
      cursor: payload.cursor,
      bucketBefore,
      limit: limit + 1,
    });
    const current = rows.slice(0, limit);
    const unitIds = [...new Set(current.map((row) => row.unitId))];
    for (const unitId of unitIds) {
      await this.recomputeUnit(unitId, {
        source: { type: "maintenance", reason: "ranking.viewBucketFlush" },
      });
    }
    if (current.length > 0) {
      await this.repository.markBucketsFlushed(
        current.map((row) => row.id),
        new Date(),
      );
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
    await this.repository.disconnect();
  }
}

export const rankingService = new RankingService();
