import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import { Comment, Post } from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  CommentDTO,
  CommentForbidden,
  CommentListResult,
  CommentNotFound,
} from "../interfaces/comments.ts";

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

function commentToDTO(row: typeof Comment.$inferSelect): CommentDTO {
  return new CommentDTO({
    id: row.id,
    rootUnitId: row.rootUnitId,
    realmUnitId: row.realmUnitId ?? null,
    parentCommentId: row.parentCommentId ?? null,
    authorUserId: row.authorUserId,
    content: row.content ?? null,
    language: row.language,
    depth: row.depth,
    replyCount: row.replyCount,
    directReplyCount: row.directReplyCount,
    lastReplyAt: row.lastReplyAt?.toISOString() ?? null,
    isLocked: row.isLocked,
    state: row.state ?? null,
    moderationStatus: row.moderationStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  });
}

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const CommentsHandlers = HttpApiBuilder.group(
  Api,
  "comments",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) =>
      Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: fetch a single comment by id
    // 共享辅助：按 id 获取单条评论
    const fetchComment = (id: string) =>
      Effect.gen(function* () {
        const rows = yield* database
          .select()
          .from(Comment)
          .where(eq(Comment.id, id));
        if (!rows[0]) return yield* new CommentNotFound();
        return commentToDTO(rows[0]);
      });

    return (
      handlers
        // ── Get comment / 获取评论 ────────────────────────────────────
        .handle("get", ({ params }) => fetchComment(params.id))

        // ── List comments (GET query string) / 列表评论（查询字符串） ──
        .handle("list", ({ query }) =>
          Effect.gen(function* () {
            const conditions: ReturnType<typeof eq>[] = [
              eq(Comment.moderationStatus, "APPROVED"),
              isNull(Comment.deletedAt),
            ];
            if (query.rootUnitId)
              conditions.push(eq(Comment.rootUnitId, query.rootUnitId));
            if (query.realmUnitId)
              conditions.push(eq(Comment.realmUnitId, query.realmUnitId));
            if (query.parentCommentId)
              conditions.push(
                eq(Comment.parentCommentId, query.parentCommentId),
              );
            const where = and(...conditions);

            const rows = yield* database
              .select()
              .from(Comment)
              .where(where)
              .orderBy(desc(Comment.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            const agg = yield* database
              .select({ total: count() })
              .from(Comment)
              .where(where);

            const items = rows.map(commentToDTO);
            return new CommentListResult({
              items,
              total: agg[0]?.total ?? 0,
            });
          }),
        )

        // ── List comments (POST body) / 列表评论（请求体） ────────────
        .handle("listByFilter", ({ payload }) =>
          Effect.gen(function* () {
            const conditions: ReturnType<typeof eq>[] = [
              eq(Comment.moderationStatus, "APPROVED"),
              isNull(Comment.deletedAt),
            ];
            if (payload.rootUnitId)
              conditions.push(eq(Comment.rootUnitId, payload.rootUnitId));
            if (payload.realmUnitId)
              conditions.push(eq(Comment.realmUnitId, payload.realmUnitId));
            // parentCommentId: explicit null → top-level only; string → specific parent; undefined → all
            // parentCommentId：显式 null → 仅顶级；字符串 → 特定父级；undefined → 全部
            if (payload.parentCommentId === null) {
              conditions.push(isNull(Comment.parentCommentId));
            } else if (payload.parentCommentId !== undefined) {
              conditions.push(
                eq(Comment.parentCommentId, payload.parentCommentId),
              );
            }
            const where = and(...conditions);

            const rows = yield* database
              .select()
              .from(Comment)
              .where(where)
              .orderBy(desc(Comment.createdAt))
              .limit(lim(payload.limit))
              .offset(payload.offset ?? 0);

            const agg = yield* database
              .select({ total: count() })
              .from(Comment)
              .where(where);

            const items = rows.map(commentToDTO);
            return new CommentListResult({
              items,
              total: agg[0]?.total ?? 0,
            });
          }),
        )

        // ── Create comment / 创建评论 ─────────────────────────────────
        .handle("create", ({ payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const language = payload.language ?? "zh-hant";
            const now = new Date();

            // Resolve depth from parent comment if replying
            // 回复时从父评论解析深度
            const depth = yield* Effect.gen(function* () {
              if (!payload.parentCommentId) return 1;
              const parents = yield* database
                .select({ depth: Comment.depth })
                .from(Comment)
                .where(eq(Comment.id, payload.parentCommentId));
              if (!parents[0]) return 1;
              return parents[0].depth + 1;
            });

            // Insert comment and update counters in a transaction
            // 在事务中插入评论并更新计数器
            const createdRows = yield* database.transaction((tx) =>
              Effect.gen(function* () {
                const inserted = yield* tx
                  .insert(Comment)
                  .values({
                    rootUnitId: payload.rootUnitId,
                    realmUnitId: payload.realmUnitId ?? null,
                    parentCommentId: payload.parentCommentId ?? null,
                    authorUserId: user.id,
                    content: payload.content,
                    language,
                    depth,
                    moderationStatus: "APPROVED",
                    updatedAt: now,
                  })
                  .returning({ id: Comment.id });

                // Increment parent comment reply counters
                // 递增父评论回复计数
                if (payload.parentCommentId) {
                  yield* tx
                    .update(Comment)
                    .set({
                      replyCount: sql`${Comment.replyCount} + 1`,
                      directReplyCount: sql`${Comment.directReplyCount} + 1`,
                      lastReplyAt: now,
                      updatedAt: now,
                    })
                    .where(eq(Comment.id, payload.parentCommentId));
                }

                // Increment root post reply counters
                // 递增根帖子回复计数
                yield* tx
                  .update(Post)
                  .set({
                    replyCount: sql`${Post.replyCount} + 1`,
                    ...(payload.parentCommentId
                      ? {}
                      : {
                          directReplyCount: sql`${Post.directReplyCount} + 1`,
                        }),
                    lastReplyAt: now,
                    updatedAt: now,
                  })
                  .where(eq(Post.unitId, payload.rootUnitId));

                return inserted;
              }),
            );

            const commentId = createdRows[0]?.id;
            if (!commentId)
              return yield* new HttpApiError.InternalServerError();

            // Fetch the full comment row for the response
            // 获取完整评论行用于响应
            const rows = yield* database
              .select()
              .from(Comment)
              .where(eq(Comment.id, commentId));
            if (!rows[0]) return yield* new HttpApiError.InternalServerError();
            return commentToDTO(rows[0]);
          }),
        )

        // ── Update comment / 更新评论 ─────────────────────────────────
        .handle("update", ({ params, payload }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const rows = yield* database
              .select()
              .from(Comment)
              .where(eq(Comment.id, params.id));
            if (!rows[0]) return yield* new CommentNotFound();
            if (rows[0].authorUserId !== user.id)
              return yield* new CommentForbidden();

            const setClause: Record<string, unknown> = {
              updatedAt: new Date(),
            };
            if (payload["content"] !== undefined)
              setClause["content"] = payload["content"];
            if (payload["language"] !== undefined)
              setClause["language"] = payload["language"];

            yield* database
              .update(Comment)
              .set(setClause)
              .where(eq(Comment.id, params.id));

            return yield* fetchComment(params.id);
          }),
        )

        // ── Moderate comment / 审核评论 ────────────────────────────────
        .handle("moderate", ({ params, payload }) =>
          Effect.gen(function* () {
            yield* CurrentUser;
            const rows = yield* database
              .select()
              .from(Comment)
              .where(eq(Comment.id, params.id));
            if (!rows[0]) return yield* new CommentNotFound();

            const status =
              payload.status as (typeof Comment.$inferInsert)["moderationStatus"];

            yield* database
              .update(Comment)
              .set({
                moderationStatus: status,
                updatedAt: new Date(),
              })
              .where(eq(Comment.id, params.id));

            return yield* fetchComment(params.id);
          }),
        )

        // ── Delete comment / 删除评论 ─────────────────────────────────
        .handle("delete", ({ params }) =>
          Effect.gen(function* () {
            const user = yield* CurrentUser;
            const rows = yield* database
              .select()
              .from(Comment)
              .where(eq(Comment.id, params.id));
            if (!rows[0]) return yield* new CommentNotFound();
            if (rows[0].authorUserId !== user.id)
              return yield* new CommentForbidden();

            // Soft-delete: clear content and set deletedAt
            // 软删除：清空内容并设置 deletedAt
            yield* database
              .update(Comment)
              .set({
                content: null,
                deletedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(Comment.id, params.id));
          }),
        )
    );
  }),
);
