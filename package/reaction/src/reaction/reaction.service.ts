import { normalizeReactionScopeKey } from "@rezics/contract/reaction";
import type { ReactionRow } from "../db/schema";
import { allowedReactionTypes } from "../env";
import {
  CursorDecodeError,
  decodeCursor,
  encodeCursor,
  type ReactionCursor,
} from "./cursor";
import {
  DrizzleReactionRepository,
  type ReactionRepository,
} from "./reaction.repository";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_TARGET_IDS = 1000;
const DEFAULT_ACTIVE_REACTION_QUOTA = 3;

export class TargetIdsOverflowError extends Error {
  readonly statusCode = 400;
  constructor() {
    super(`targetIds exceeds maximum of ${MAX_TARGET_IDS} entries per request`);
    this.name = "TargetIdsOverflowError";
  }
}

export class MalformedCursorError extends Error {
  readonly statusCode = 400;
  constructor() {
    super("Malformed cursor");
    this.name = "MalformedCursorError";
  }
}

export class ReactionQuotaExceededError extends Error {
  readonly statusCode = 409;
  constructor() {
    super(
      `Active reaction quota exceeded for target; limit is ${DEFAULT_ACTIVE_REACTION_QUOTA}`,
    );
    this.name = "ReactionQuotaExceededError";
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_LIMIT;
  const floored = Math.floor(limit);
  if (floored < 1) return 1;
  if (floored > MAX_LIMIT) return MAX_LIMIT;
  return floored;
}

function decodeOptionalCursor(raw: string | undefined): ReactionCursor | null {
  if (!raw) return null;
  try {
    return decodeCursor(raw);
  } catch (e) {
    if (e instanceof CursorDecodeError) throw new MalformedCursorError();
    throw e;
  }
}

function rowToDto(row: ReactionRow): {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  scopeKey: string;
  createdAt: string;
} {
  return {
    id: row.id,
    userId: row.userId,
    targetId: row.targetId,
    reaction: row.reaction,
    scopeKey: row.scopeKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListGivenInput {
  userId: string;
  reactions?: string[];
  scopeKey?: string;
  cursor?: string;
  limit?: number;
}

export interface ListByUserInput {
  targetIds: string[];
  reactions?: string[];
  scopeKey?: string;
  excludeUserId?: string;
  cursor?: string;
  limit?: number;
}

export interface ReactionListResult {
  items: ReturnType<typeof rowToDto>[];
  nextCursor: string | null;
}

export class ReactionService {
  constructor(
    private readonly repository: ReactionRepository = new DrizzleReactionRepository(),
  ) {}

  /**
   * Get aggregated reaction counts for one or more targets.
   * 获取一个或多个目标的聚合反应计数。
   */
  async getSummary(
    targetIds: string[],
    scopeKey?: string,
  ): Promise<Record<string, Record<string, number>>> {
    if (!targetIds.length) return {};

    const result: Record<string, Record<string, number>> = {};
    for (const id of targetIds) {
      result[id] = {};
    }

    const normalizedScopeKey =
      scopeKey === undefined ? undefined : normalizeReactionScopeKey(scopeKey);
    const rows = await this.repository.getSummaryRows(
      targetIds,
      normalizedScopeKey,
    );

    for (const row of rows) {
      const target = result[row.targetId];
      if (!target) continue;
      target[row.reaction] = row.count;
    }
    return result;
  }

  /**
   * Get current user's reaction types for one or more targets.
   * 获取当前用户对一个或多个目标的反应类型。
   */
  async getUserReactions(
    userId: string,
    targetIds: string[],
    scopeKey?: string,
  ): Promise<Record<string, string[]>> {
    if (!targetIds.length) return {};
    const normalizedScopeKey = normalizeReactionScopeKey(scopeKey);

    const rows = await this.repository.getUserReactionRows(
      userId,
      targetIds,
      normalizedScopeKey,
    );

    const result: Record<string, string[]> = {};
    for (const id of targetIds) {
      result[id] = [];
    }
    for (const row of rows) {
      result[row.targetId]?.push(row.reaction);
    }
    return result;
  }

  /**
   * Create a reaction (idempotent).
   * Returns the reaction and whether it was newly created.
   * 创建一个反应（幂等）。
   * 返回该反应以及它是否为新创建的。
   */
  async create(
    userId: string,
    targetId: string,
    reaction: string,
    scopeKey?: string,
  ): Promise<{ reaction: ReactionRow; created: boolean }> {
    if (!allowedReactionTypes.has(reaction)) {
      throw new Error(`Invalid reaction type: ${reaction}`);
    }
    const normalizedScopeKey = normalizeReactionScopeKey(scopeKey);

    const result = await this.repository.createReaction({
      userId,
      targetId,
      reaction,
      scopeKey: normalizedScopeKey,
      defaultQuota: DEFAULT_ACTIVE_REACTION_QUOTA,
    });

    if (result.quotaExceeded) throw new ReactionQuotaExceededError();
    return result;
  }

  /**
   * List a user's own reaction events in reverse-chronological order,
   * paged with an opaque `(createdAt, id)` cursor.
   * 按时间倒序列出用户自己的反应事件，使用不透明的 `(createdAt, id)` 游标分页。
   */
  async listGiven(input: ListGivenInput): Promise<ReactionListResult> {
    const limit = clampLimit(input.limit);
    const cursor = decodeOptionalCursor(input.cursor);

    const rows = await this.repository.listRows({
      userId: input.userId,
      scopeKey: input.scopeKey
        ? normalizeReactionScopeKey(input.scopeKey)
        : undefined,
      reactions: input.reactions,
      cursor,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    return { items: sliced.map(rowToDto), nextCursor };
  }

  /**
   * List reactions placed on a given set of target ids, optionally excluding
   * a specific user. Used by the main server to render Received history.
   * 列出针对给定一组目标 id 的反应，可选地排除某个特定用户。主服务器用它
   * 来渲染“收到的”历史记录。
   */
  async listByUser(input: ListByUserInput): Promise<ReactionListResult> {
    if (input.targetIds.length > MAX_TARGET_IDS) {
      throw new TargetIdsOverflowError();
    }
    if (input.targetIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const limit = clampLimit(input.limit);
    const cursor = decodeOptionalCursor(input.cursor);

    const rows = await this.repository.listRows({
      targetIds: input.targetIds,
      scopeKey: input.scopeKey
        ? normalizeReactionScopeKey(input.scopeKey)
        : undefined,
      reactions: input.reactions,
      excludeUserId: input.excludeUserId,
      cursor,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    return { items: sliced.map(rowToDto), nextCursor };
  }

  /**
   * Delete a reaction (idempotent). Decrements summary if deleted.
   * 删除一个反应（幂等）。若已删除则递减汇总计数。
   */
  async remove(
    userId: string,
    targetId: string,
    reaction: string,
    scopeKey?: string,
  ): Promise<{ deleted: boolean }> {
    return await this.repository.removeReaction({
      userId,
      targetId,
      reaction,
      scopeKey: normalizeReactionScopeKey(scopeKey),
    });
  }

  async cleanupTarget(targetId: string): Promise<{ count: number }> {
    return await this.repository.cleanupTarget(targetId);
  }

  async recordShare(
    userId: string,
    targetId: string,
  ): Promise<{ targetId: string; shareCount: number; created: boolean }> {
    return await this.repository.recordShare({ userId, targetId });
  }

  async getShareSummary(
    targetIds: string[],
  ): Promise<Record<string, { shareCount: number }>> {
    const result: Record<string, { shareCount: number }> = {};
    for (const id of targetIds) {
      result[id] = { shareCount: 0 };
    }
    const rows = await this.repository.getShareSummaryRows(targetIds);
    for (const row of rows) {
      result[row.targetId] = { shareCount: row.shareCount };
    }
    return result;
  }
}

export const reactionService = new ReactionService();
