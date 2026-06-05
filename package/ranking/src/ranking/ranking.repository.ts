import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, disconnectRankingDb } from "../db/client";
import {
  type RankingSignalBucketRow,
  rankingSignalBuckets,
  type ServingPatchStatusRow,
  servingPatchStatuses,
  type UnitRankProjectionRow,
  unitRankProjections,
} from "../db/schema";
import type {
  RankingScores,
  RankingSignalSnapshot,
  RankKind,
  ScopeKind,
} from "./types";

export type RankingSignalKind = "view" | "read";
export type RankingPatchStatus = "pending" | "patched" | "failed" | "skipped";

export type ProjectionUpsertInput = RankingScores & {
  unitId: string;
  scopeKind: ScopeKind;
  scopeId: string | null;
  scopeKey: string;
  rankKind: RankKind;
  formulaVersion: string;
  signalSnapshot: RankingSignalSnapshot;
  computedAt: Date;
  rankUpdatedAt: Date | null;
};

export type ServingPatchStatusInput = {
  projectionId: string;
  unitId: string;
  indexName: string;
  documentId: string;
  status: RankingPatchStatus;
  patchedAt?: Date | null;
  lastAttemptAt?: Date | null;
  retryCount?: number;
  lastError?: string | null;
  source?: unknown;
};

export interface RankingRepository {
  ping(): Promise<void>;
  findProjectionsByUnit(unitId: string): Promise<UnitRankProjectionRow[]>;
  upsertProjection(
    input: ProjectionUpsertInput,
  ): Promise<UnitRankProjectionRow>;
  upsertSignalBucket(input: {
    unitId: string;
    signalKind: RankingSignalKind;
    bucketStart: Date;
    bucketEnd: Date;
    count: number;
    metadata?: unknown;
  }): Promise<RankingSignalBucketRow>;
  readBucketSignals(unitId: string): Promise<{ views: number; reads: number }>;
  findProjectionsForPatch(input: {
    unitId?: string;
    projectionId?: string;
    rankKind?: RankKind;
    limit: number;
  }): Promise<UnitRankProjectionRow[]>;
  createServingPatchStatus(
    input: ServingPatchStatusInput,
  ): Promise<ServingPatchStatusRow>;
  findFlushableBuckets(input: {
    cursor?: string;
    bucketBefore: Date;
    limit: number;
  }): Promise<RankingSignalBucketRow[]>;
  markBucketsFlushed(ids: string[], flushedAt: Date): Promise<void>;
  disconnect(): Promise<void>;
}

export class DrizzleRankingRepository implements RankingRepository {
  async ping(): Promise<void> {
    await db.execute(sql`SELECT 1`);
  }

  async findProjectionsByUnit(
    unitId: string,
  ): Promise<UnitRankProjectionRow[]> {
    return db
      .select()
      .from(unitRankProjections)
      .where(eq(unitRankProjections.unitId, unitId))
      .orderBy(
        asc(unitRankProjections.rankKind),
        asc(unitRankProjections.scopeKind),
      );
  }

  async upsertProjection(
    input: ProjectionUpsertInput,
  ): Promise<UnitRankProjectionRow> {
    const now = new Date();
    const [projection] = await db
      .insert(unitRankProjections)
      .values({
        ...input,
        signalSnapshot: input.signalSnapshot,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          unitRankProjections.unitId,
          unitRankProjections.scopeKind,
          unitRankProjections.scopeKey,
          unitRankProjections.rankKind,
        ],
        set: {
          hotScore: input.hotScore,
          topScore: input.topScore,
          trendingScore: input.trendingScore,
          qualityScore: input.qualityScore,
          scopeId: input.scopeId,
          formulaVersion: input.formulaVersion,
          signalSnapshot: input.signalSnapshot,
          computedAt: input.computedAt,
          rankUpdatedAt: input.rankUpdatedAt,
          updatedAt: now,
        },
      })
      .returning();

    if (!projection) {
      throw new Error("Failed to upsert ranking projection");
    }
    return projection;
  }

  async upsertSignalBucket(input: {
    unitId: string;
    signalKind: RankingSignalKind;
    bucketStart: Date;
    bucketEnd: Date;
    count: number;
    metadata?: unknown;
  }): Promise<RankingSignalBucketRow> {
    const now = new Date();
    const updateSet = {
      count: sql`${rankingSignalBuckets.count} + ${input.count}`,
      bucketEnd: input.bucketEnd,
      updatedAt: now,
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    };
    const [bucket] = await db
      .insert(rankingSignalBuckets)
      .values({
        unitId: input.unitId,
        signalKind: input.signalKind,
        bucketStart: input.bucketStart,
        bucketEnd: input.bucketEnd,
        count: input.count,
        metadata: input.metadata ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          rankingSignalBuckets.unitId,
          rankingSignalBuckets.signalKind,
          rankingSignalBuckets.bucketStart,
        ],
        set: updateSet,
      })
      .returning();

    if (!bucket) {
      throw new Error("Failed to upsert ranking signal bucket");
    }
    return bucket;
  }

  async readBucketSignals(
    unitId: string,
  ): Promise<{ views: number; reads: number }> {
    const rows = await db
      .select({
        signalKind: rankingSignalBuckets.signalKind,
        count: sql<number>`coalesce(sum(${rankingSignalBuckets.count}), 0)`,
      })
      .from(rankingSignalBuckets)
      .where(eq(rankingSignalBuckets.unitId, unitId))
      .groupBy(rankingSignalBuckets.signalKind);

    return {
      views: Number(rows.find((row) => row.signalKind === "view")?.count ?? 0),
      reads: Number(rows.find((row) => row.signalKind === "read")?.count ?? 0),
    };
  }

  async findProjectionsForPatch(input: {
    unitId?: string;
    projectionId?: string;
    rankKind?: RankKind;
    limit: number;
  }): Promise<UnitRankProjectionRow[]> {
    const conditions = [
      input.projectionId
        ? eq(unitRankProjections.id, input.projectionId)
        : undefined,
      input.unitId ? eq(unitRankProjections.unitId, input.unitId) : undefined,
      input.rankKind
        ? eq(unitRankProjections.rankKind, input.rankKind)
        : undefined,
    ].filter((condition) => condition !== undefined);

    return db
      .select()
      .from(unitRankProjections)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(unitRankProjections.computedAt))
      .limit(input.limit);
  }

  async createServingPatchStatus(
    input: ServingPatchStatusInput,
  ): Promise<ServingPatchStatusRow> {
    const now = new Date();
    const [status] = await db
      .insert(servingPatchStatuses)
      .values({
        projectionId: input.projectionId,
        unitId: input.unitId,
        indexName: input.indexName,
        documentId: input.documentId,
        status: input.status,
        patchedAt: input.patchedAt ?? null,
        lastAttemptAt: input.lastAttemptAt ?? null,
        retryCount: input.retryCount ?? 0,
        lastError: input.lastError ?? null,
        source: input.source === undefined ? null : input.source,
        updatedAt: now,
      })
      .returning();

    if (!status) {
      throw new Error("Failed to create ranking patch status");
    }
    return status;
  }

  async findFlushableBuckets(input: {
    cursor?: string;
    bucketBefore: Date;
    limit: number;
  }): Promise<RankingSignalBucketRow[]> {
    const cursorRow = input.cursor
      ? (
          await db
            .select()
            .from(rankingSignalBuckets)
            .where(eq(rankingSignalBuckets.id, input.cursor))
            .limit(1)
        )[0]
      : undefined;

    const afterCursor = cursorRow
      ? or(
          gt(rankingSignalBuckets.unitId, cursorRow.unitId),
          and(
            eq(rankingSignalBuckets.unitId, cursorRow.unitId),
            gt(rankingSignalBuckets.bucketStart, cursorRow.bucketStart),
          ),
          and(
            eq(rankingSignalBuckets.unitId, cursorRow.unitId),
            eq(rankingSignalBuckets.bucketStart, cursorRow.bucketStart),
            gt(rankingSignalBuckets.id, cursorRow.id),
          ),
        )
      : undefined;

    return db
      .select()
      .from(rankingSignalBuckets)
      .where(
        and(
          isNull(rankingSignalBuckets.flushedAt),
          lte(rankingSignalBuckets.bucketEnd, input.bucketBefore),
          afterCursor,
        ),
      )
      .orderBy(
        asc(rankingSignalBuckets.unitId),
        asc(rankingSignalBuckets.bucketStart),
        asc(rankingSignalBuckets.id),
      )
      .limit(input.limit);
  }

  async markBucketsFlushed(ids: string[], flushedAt: Date): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(rankingSignalBuckets)
      .set({ flushedAt, updatedAt: new Date() })
      .where(inArray(rankingSignalBuckets.id, ids));
  }

  async disconnect(): Promise<void> {
    await disconnectRankingDb();
  }
}
