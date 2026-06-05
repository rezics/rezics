import { and, desc, eq, inArray, lt, ne, or, type SQL, sql } from "drizzle-orm";
import { db, type ReactionDb } from "../db";
import {
  type ReactionRow,
  reactionSummaries,
  reactions,
  reactionTargetUsages,
} from "../db/schema";
import type { ReactionCursor } from "./cursor";

export interface ListReactionRowsInput {
  userId?: string;
  targetIds?: string[];
  reactions?: string[];
  scopeKey?: string;
  excludeUserId?: string;
  cursor: ReactionCursor | null;
  take: number;
}

export interface CreateReactionInput {
  userId: string;
  targetId: string;
  reaction: string;
  scopeKey: string;
  defaultQuota: number;
}

export interface RemoveReactionInput {
  userId: string;
  targetId: string;
  reaction: string;
  scopeKey: string;
}

export interface ReactionRepository {
  getSummaryRows(
    targetIds: string[],
    scopeKey: string | undefined,
  ): Promise<Array<{ targetId: string; reaction: string; count: number }>>;
  getUserReactionRows(
    userId: string,
    targetIds: string[],
    scopeKey: string,
  ): Promise<Array<{ targetId: string; reaction: string }>>;
  listRows(input: ListReactionRowsInput): Promise<ReactionRow[]>;
  createReaction(input: CreateReactionInput): Promise<{
    reaction: ReactionRow;
    created: boolean;
    quotaExceeded: boolean;
  }>;
  removeReaction(input: RemoveReactionInput): Promise<{ deleted: boolean }>;
  cleanupTarget(targetId: string): Promise<{ count: number }>;
}

function cursorPredicate(cursor: ReactionCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  // (createdAt, id) < (cursor.createdAt, cursor.id) under desc/desc order.
  return or(
    lt(reactions.createdAt, cursor.createdAt),
    and(eq(reactions.createdAt, cursor.createdAt), lt(reactions.id, cursor.id)),
  );
}

function definedConditions(
  conditions: Array<SQL | undefined>,
): SQL | undefined {
  const defined = conditions.filter((condition): condition is SQL =>
    Boolean(condition),
  );
  if (defined.length === 0) return undefined;
  return and(...defined);
}

export class DrizzleReactionRepository implements ReactionRepository {
  constructor(private readonly database: ReactionDb = db) {}

  async getSummaryRows(
    targetIds: string[],
    scopeKey: string | undefined,
  ): Promise<Array<{ targetId: string; reaction: string; count: number }>> {
    if (scopeKey === undefined) {
      const rows = await this.database
        .select({
          targetId: reactionSummaries.targetId,
          reaction: reactionSummaries.reaction,
          count: sql<number>`coalesce(sum(${reactionSummaries.count}), 0)::int`,
        })
        .from(reactionSummaries)
        .where(inArray(reactionSummaries.targetId, targetIds))
        .groupBy(reactionSummaries.targetId, reactionSummaries.reaction);
      return rows;
    }

    return await this.database
      .select({
        targetId: reactionSummaries.targetId,
        reaction: reactionSummaries.reaction,
        count: reactionSummaries.count,
      })
      .from(reactionSummaries)
      .where(
        and(
          inArray(reactionSummaries.targetId, targetIds),
          eq(reactionSummaries.scopeKey, scopeKey),
        ),
      );
  }

  async getUserReactionRows(
    userId: string,
    targetIds: string[],
    scopeKey: string,
  ): Promise<Array<{ targetId: string; reaction: string }>> {
    return await this.database
      .select({ targetId: reactions.targetId, reaction: reactions.reaction })
      .from(reactions)
      .where(
        and(
          eq(reactions.userId, userId),
          inArray(reactions.targetId, targetIds),
          eq(reactions.scopeKey, scopeKey),
        ),
      );
  }

  async listRows(input: ListReactionRowsInput): Promise<ReactionRow[]> {
    return await this.database
      .select()
      .from(reactions)
      .where(
        definedConditions([
          input.userId ? eq(reactions.userId, input.userId) : undefined,
          input.targetIds && input.targetIds.length > 0
            ? inArray(reactions.targetId, input.targetIds)
            : undefined,
          input.scopeKey ? eq(reactions.scopeKey, input.scopeKey) : undefined,
          input.reactions && input.reactions.length > 0
            ? inArray(reactions.reaction, input.reactions)
            : undefined,
          input.excludeUserId
            ? ne(reactions.userId, input.excludeUserId)
            : undefined,
          cursorPredicate(input.cursor),
        ]),
      )
      .orderBy(desc(reactions.createdAt), desc(reactions.id))
      .limit(input.take);
  }

  async createReaction(input: CreateReactionInput): Promise<{
    reaction: ReactionRow;
    created: boolean;
    quotaExceeded: boolean;
  }> {
    return await this.database.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, input.userId),
            eq(reactions.targetId, input.targetId),
            eq(reactions.reaction, input.reaction),
            eq(reactions.scopeKey, input.scopeKey),
          ),
        )
        .limit(1);
      if (existing) {
        return { reaction: existing, created: false, quotaExceeded: false };
      }

      await tx
        .insert(reactionTargetUsages)
        .values({
          userId: input.userId,
          targetId: input.targetId,
          activeCount: 0,
          maxActive: input.defaultQuota,
        })
        .onConflictDoNothing({
          target: [reactionTargetUsages.userId, reactionTargetUsages.targetId],
        });

      const [usage] = await tx
        .update(reactionTargetUsages)
        .set({
          activeCount: sql`${reactionTargetUsages.activeCount} + 1`,
        })
        .where(
          and(
            eq(reactionTargetUsages.userId, input.userId),
            eq(reactionTargetUsages.targetId, input.targetId),
            lt(
              reactionTargetUsages.activeCount,
              reactionTargetUsages.maxActive,
            ),
          ),
        )
        .returning({ activeCount: reactionTargetUsages.activeCount });
      if (!usage) {
        return {
          reaction: null as never,
          created: false,
          quotaExceeded: true,
        };
      }

      const [created] = await tx
        .insert(reactions)
        .values({
          userId: input.userId,
          targetId: input.targetId,
          reaction: input.reaction,
          scopeKey: input.scopeKey,
        })
        .returning();
      if (!created) {
        throw new Error("Reaction insert returned no row");
      }

      await tx
        .insert(reactionSummaries)
        .values({
          targetId: input.targetId,
          reaction: input.reaction,
          scopeKey: input.scopeKey,
          count: 1,
        })
        .onConflictDoUpdate({
          target: [
            reactionSummaries.targetId,
            reactionSummaries.reaction,
            reactionSummaries.scopeKey,
          ],
          set: { count: sql`${reactionSummaries.count} + 1` },
        });

      return { reaction: created, created: true, quotaExceeded: false };
    });
  }

  async removeReaction(
    input: RemoveReactionInput,
  ): Promise<{ deleted: boolean }> {
    return await this.database.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: reactions.id })
        .from(reactions)
        .where(
          and(
            eq(reactions.userId, input.userId),
            eq(reactions.targetId, input.targetId),
            eq(reactions.reaction, input.reaction),
            eq(reactions.scopeKey, input.scopeKey),
          ),
        )
        .limit(1);
      if (!existing) return { deleted: false };

      await tx
        .delete(reactions)
        .where(
          and(
            eq(reactions.userId, input.userId),
            eq(reactions.targetId, input.targetId),
            eq(reactions.reaction, input.reaction),
            eq(reactions.scopeKey, input.scopeKey),
          ),
        );

      await tx
        .update(reactionSummaries)
        .set({ count: sql`${reactionSummaries.count} - 1` })
        .where(
          and(
            eq(reactionSummaries.targetId, input.targetId),
            eq(reactionSummaries.reaction, input.reaction),
            eq(reactionSummaries.scopeKey, input.scopeKey),
          ),
        );
      await tx
        .update(reactionTargetUsages)
        .set({ activeCount: sql`${reactionTargetUsages.activeCount} - 1` })
        .where(
          and(
            eq(reactionTargetUsages.userId, input.userId),
            eq(reactionTargetUsages.targetId, input.targetId),
          ),
        );

      return { deleted: true };
    });
  }

  async cleanupTarget(targetId: string): Promise<{ count: number }> {
    return await this.database.transaction(async (tx) => {
      const deleted = await tx
        .delete(reactions)
        .where(eq(reactions.targetId, targetId))
        .returning({ id: reactions.id });
      await tx
        .delete(reactionSummaries)
        .where(eq(reactionSummaries.targetId, targetId));
      await tx
        .delete(reactionTargetUsages)
        .where(eq(reactionTargetUsages.targetId, targetId));
      return { count: deleted.length };
    });
  }
}
