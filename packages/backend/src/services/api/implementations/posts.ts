import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, count, desc, eq, inArray } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  CommentPromotion,
  ContentTranslation,
  Post,
  Unit,
  UnitRealm,
  UnitTranslation,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import { ModerationOverlayResult, PostDTO, PostForbidden, PostListResult, PostNotFound } from "../interfaces/posts.ts";

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

function postToDTO(
  unit: typeof Unit.$inferSelect,
  post: typeof Post.$inferSelect,
  translation: typeof UnitTranslation.$inferSelect | undefined,
  content: typeof ContentTranslation.$inferSelect | undefined,
) {
  return new PostDTO({
    unitId: post.unitId,
    authorUserId: post.authorUserId,
    kind: post.kind ?? null,
    replyCount: post.replyCount,
    directReplyCount: post.directReplyCount,
    lastReplyAt: post.lastReplyAt?.toISOString() ?? null,
    isLocked: post.isLocked,
    state: post.state ?? null,
    variantUnitId: post.variantUnitId ?? null,
    title: (translation?.title as string) ?? null,
    summary: (translation?.summary as string) ?? null,
    content: content?.content ?? null,
    slug: unit.slug ?? null,
    status: unit.status,
    visibility: unit.visibility,
    language: unit.defaultLanguage ?? null,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const PostsHandlers = HttpApiBuilder.group(
  Api,
  "posts",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: fetch a single post with joined relations
    // 共享辅助：获取单条帖子及其关联数据
    const fetchPost = (unitId: string) =>
      Effect.gen(function* () {
        const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, unitId)));
        if (!units[0]) return yield* new PostNotFound();
        const posts = yield* Effect.orDie(database.select().from(Post).where(eq(Post.unitId, unitId)));
        if (!posts[0]) return yield* new PostNotFound();
        const lang = units[0].defaultLanguage ?? "en";
        const translations = yield* Effect.orDie(
          database
            .select()
            .from(UnitTranslation)
            .where(and(eq(UnitTranslation.unitId, unitId), eq(UnitTranslation.language, lang))),
        );
        const contents = yield* Effect.orDie(
          database
            .select()
            .from(ContentTranslation)
            .where(and(eq(ContentTranslation.unitId, unitId), eq(ContentTranslation.language, lang))),
        );
        return postToDTO(units[0], posts[0], translations[0], contents[0]);
      });

    return handlers
      // ── Get post / 获取帖子 ────────────────────────────────────
      .handle("get", ({ params }) => fetchPost(params.unitId))

      // ── Create post / 创建帖子 ─────────────────────────────────
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const language = payload.language ?? "en";
          const unitRows = yield* Effect.orDie(
            database
              .insert(Unit)
              .values({
                type: "POST",
                userId: user.id,
                slugScope: user.id,
                defaultLanguage: language,
                status: "DRAFT",
              })
              .returning(),
          );
          const unit = unitRows[0]!;

          yield* Effect.orDie(
            database.insert(Post).values({
              unitId: unit.id,
              authorUserId: user.id,
              kind: (payload.kind as (typeof Post.$inferInsert)["kind"]) ?? "POST",
              variantUnitId: payload.variantUnitId ?? undefined,
            }),
          );

          if (payload.title) {
            yield* Effect.orDie(
              database.insert(UnitTranslation).values({
                unitId: unit.id,
                language,
                title: payload.title,
              }),
            );
          }

          if (payload.content) {
            yield* Effect.orDie(
              database.insert(ContentTranslation).values({
                unitId: unit.id,
                language,
                content: payload.content,
              }),
            );
          }

          if (payload.realmUnitId) {
            yield* Effect.orDie(
              database.insert(UnitRealm).values({
                realmUnitId: payload.realmUnitId,
                unitId: unit.id,
              }),
            );
          }

          return yield* Effect.orDie(fetchPost(unit.id));
        }),
      )

      // ── Update post / 更新帖子 ─────────────────────────────────
      .handle("update", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, params.unitId)));
          if (!units[0]) return yield* new PostNotFound();
          if (units[0].userId !== user.id) return yield* new PostForbidden();

          const language = payload.language ?? units[0].defaultLanguage ?? "en";

          if (payload.variantUnitId !== undefined) {
            yield* Effect.orDie(
              database
                .update(Post)
                .set({ variantUnitId: payload.variantUnitId ?? null, updatedAt: new Date() })
                .where(eq(Post.unitId, params.unitId)),
            );
          }

          if (payload.title) {
            yield* Effect.orDie(
              database
                .insert(UnitTranslation)
                .values({ unitId: params.unitId, language, title: payload.title })
                .onConflictDoUpdate({
                  target: [UnitTranslation.unitId, UnitTranslation.language],
                  set: { title: payload.title, updatedAt: new Date() },
                }),
            );
          }

          if (payload.content) {
            yield* Effect.orDie(
              database
                .insert(ContentTranslation)
                .values({ unitId: params.unitId, language, content: payload.content })
                .onConflictDoUpdate({
                  target: [ContentTranslation.unitId, ContentTranslation.language],
                  set: { content: payload.content, updatedAt: new Date() },
                }),
            );
          }

          yield* Effect.orDie(database.update(Unit).set({ updatedAt: new Date() }).where(eq(Unit.id, params.unitId)));
          return yield* fetchPost(params.unitId);
        }),
      )

      // ── Delete post / 删除帖子 ─────────────────────────────────
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, params.unitId)));
          if (!units[0]) return yield* new PostNotFound();
          if (units[0].userId !== user.id) return yield* new PostForbidden();
          yield* Effect.orDie(database.delete(Unit).where(eq(Unit.id, params.unitId)));
        }),
      )

      // ── List posts (GET query string) / 列表帖子（查询字符串） ──
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const conditions: ReturnType<typeof eq>[] = [];
          if (query.authorUserId) conditions.push(eq(Post.authorUserId, query.authorUserId));
          if (query.kind) conditions.push(eq(Post.kind, query.kind as (typeof Post.kind.enumValues)[number]));
          const where = conditions.length > 0 ? and(...conditions) : undefined;

          const rows = yield* Effect.orDie(
            database
              .select({ post: Post, unit: Unit })
              .from(Post)
              .innerJoin(Unit, eq(Unit.id, Post.unitId))
              .where(where)
              .orderBy(desc(Unit.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0),
          );

          const unitIds = rows.map((r) => r.unit.id);
          const translations =
            unitIds.length > 0
              ? yield* Effect.orDie(database.select().from(UnitTranslation).where(inArray(UnitTranslation.unitId, unitIds)))
              : [];
          const transMap = new Map(translations.map((t) => [`${t.unitId}:${t.language}`, t]));

          const agg = yield* Effect.orDie(database.select({ total: count() }).from(Post).where(where));

          const items = rows.map((r) => {
            const lang = r.unit.defaultLanguage ?? "en";
            const trans = transMap.get(`${r.unit.id}:${lang}`);
            return postToDTO(r.unit, r.post, trans, undefined);
          });

          return new PostListResult({ items, total: agg[0]?.total ?? 0 });
        }),
      )

      // ── List posts (POST body) / 列表帖子（请求体） ────────────
      .handle("listByFilter", ({ payload }) =>
        Effect.gen(function* () {
          const conditions: ReturnType<typeof eq>[] = [];
          if (payload.authorUserId) conditions.push(eq(Post.authorUserId, payload.authorUserId));
          if (payload.kind) conditions.push(eq(Post.kind, payload.kind as (typeof Post.kind.enumValues)[number]));
          const where = conditions.length > 0 ? and(...conditions) : undefined;

          const rows = yield* Effect.orDie(
            database
              .select({ post: Post, unit: Unit })
              .from(Post)
              .innerJoin(Unit, eq(Unit.id, Post.unitId))
              .where(where)
              .orderBy(desc(Unit.createdAt))
              .limit(lim(payload.limit))
              .offset(payload.offset ?? 0),
          );

          const unitIds = rows.map((r) => r.unit.id);
          const translations =
            unitIds.length > 0
              ? yield* Effect.orDie(database.select().from(UnitTranslation).where(inArray(UnitTranslation.unitId, unitIds)))
              : [];
          const transMap = new Map(translations.map((t) => [`${t.unitId}:${t.language}`, t]));

          const agg = yield* Effect.orDie(database.select({ total: count() }).from(Post).where(where));

          const items = rows.map((r) => {
            const lang = r.unit.defaultLanguage ?? "en";
            const trans = transMap.get(`${r.unit.id}:${lang}`);
            return postToDTO(r.unit, r.post, trans, undefined);
          });

          return new PostListResult({ items, total: agg[0]?.total ?? 0 });
        }),
      )

      // ── Moderation overlays / 审核覆盖数据 ─────────────────────
      .handle("moderationOverlays", ({ payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          const overlays: Record<string, unknown> = {};
          if (payload.unitIds.length > 0) {
            const realms = yield* Effect.orDie(
              database.select().from(UnitRealm).where(inArray(UnitRealm.unitId, [...payload.unitIds])),
            );
            for (const r of realms) {
              overlays[r.unitId] = { realmUnitId: r.realmUnitId, moderationStatus: r.moderationStatus };
            }
          }
          return new ModerationOverlayResult({ overlays });
        }),
      )

      // ── Publish / 发布 ─────────────────────────────────────────
      .handle("publish", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, params.unitId)));
          if (!units[0]) return yield* new PostNotFound();
          if (units[0].userId !== user.id) return yield* new PostForbidden();
          yield* Effect.orDie(
            database
              .update(Unit)
              .set({ status: "PUBLISHED", publishedAt: new Date(), updatedAt: new Date() })
              .where(eq(Unit.id, params.unitId)),
          );
          return yield* fetchPost(params.unitId);
        }),
      )

      // ── Submit to realm / 提交到 realm ─────────────────────────
      .handle("submitToRealm", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, params.unitId)));
          if (!units[0]) return yield* new PostNotFound();
          if (units[0].userId !== user.id) return yield* new PostForbidden();
          yield* Effect.orDie(
            database
              .insert(UnitRealm)
              .values({ realmUnitId: payload.realmUnitId, unitId: params.unitId })
              .onConflictDoNothing(),
          );
          return yield* fetchPost(params.unitId);
        }),
      )

      // ── Set state / 设置状态 ───────────────────────────────────
      .handle("setState", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, params.unitId)));
          if (!units[0]) return yield* new PostNotFound();
          if (units[0].userId !== user.id) return yield* new PostForbidden();
          yield* Effect.orDie(
            database.update(Post).set({ state: payload.state, updatedAt: new Date() }).where(eq(Post.unitId, params.unitId)),
          );
          return yield* fetchPost(params.unitId);
        }),
      )

      // ── Create pin / 置顶 ─────────────────────────────────────
      .handle("createPin", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, payload.unitId)));
          if (!units[0]) return yield* new PostNotFound();
          yield* Effect.orDie(
            database
              .insert(CommentPromotion)
              .values({
                scopeUnitId: payload.unitId,
                commentId: payload.unitId,
                kind: (payload.kind as (typeof CommentPromotion.$inferInsert)["kind"]) ?? "PINNED",
                position: "V",
                byUserId: user.id,
              })
              .onConflictDoNothing(),
          );
          return yield* fetchPost(payload.unitId);
        }),
      )

      // ── Delete pin / 取消置顶 ──────────────────────────────────
      .handle("deletePin", ({ payload }) =>
        Effect.gen(function* () {
          yield* CurrentUser;
          yield* Effect.orDie(
            database
              .delete(CommentPromotion)
              .where(
                and(eq(CommentPromotion.scopeUnitId, payload.unitId), eq(CommentPromotion.commentId, payload.unitId)),
              ),
          );
        }),
      )

      // ── Accept answer / 采纳回答 ───────────────────────────────
      .handle("acceptAnswer", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, payload.postUnitId)));
          if (!units[0]) return yield* new PostNotFound();
          if (units[0].userId !== user.id) return yield* new PostForbidden();
          yield* Effect.orDie(
            database
              .insert(CommentPromotion)
              .values({
                scopeUnitId: payload.postUnitId,
                commentId: payload.commentId,
                kind: "ACCEPTED_ANSWER",
                position: "V",
                byUserId: user.id,
              })
              .onConflictDoNothing(),
          );
          return yield* fetchPost(payload.postUnitId);
        }),
      )

      // ── Remove accepted answer / 移除采纳回答 ──────────────────
      .handle("removeAcceptedAnswer", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const units = yield* Effect.orDie(database.select().from(Unit).where(eq(Unit.id, payload.postUnitId)));
          if (!units[0]) return yield* new PostNotFound();
          if (units[0].userId !== user.id) return yield* new PostForbidden();
          yield* Effect.orDie(
            database
              .delete(CommentPromotion)
              .where(
                and(
                  eq(CommentPromotion.scopeUnitId, payload.postUnitId),
                  eq(CommentPromotion.commentId, payload.commentId),
                  eq(CommentPromotion.kind, "ACCEPTED_ANSWER"),
                ),
              ),
          );
        }),
      );
  }),
);
