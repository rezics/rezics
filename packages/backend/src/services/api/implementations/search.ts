import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  Comment,
  Unit,
  UnitTranslation,
  User,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { AdminMessageResult } from "../interfaces/search.ts";

// ---------------------------------------------------------------------------
// Constants / 常量
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Shared helpers / 共享辅助函数
// ---------------------------------------------------------------------------

/** Clamp and default a user-supplied limit. / 限制并默认化用户提供的 limit。 */
const clampLimit = (n: number | undefined, max: number) =>
  Math.min(n ?? DEFAULT_LIMIT, max);

/**
 * Build an ilike condition against UnitTranslation.title for a search query.
 * 为搜索查询构建针对 UnitTranslation.title 的 ilike 条件。
 */
const titleLike = (q: string) => ilike(UnitTranslation.title, `%${q}%`);

// ---------------------------------------------------------------------------
// Handlers / 处理器
// ---------------------------------------------------------------------------

export const SearchHandlers = HttpApiBuilder.group(
  Api,
  "search",
  Effect.fn(function* (handlers) {
    const db = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n: number | undefined) =>
      clampLimit(n, Math.min(MAX_LIMIT, pagination.maxLimit));

    // -----------------------------------------------------------------------
    // Generic unit-by-type search helper
    // 按类型通用 Unit 搜索辅助函数
    // -----------------------------------------------------------------------

    const searchUnitsByType = (opts: {
      type: (typeof Unit.type.enumValues)[number];
      q?: string;
      limit?: number;
      offset?: number;
    }) =>
      Effect.gen(function* () {
        const conditions: ReturnType<typeof eq>[] = [
          eq(Unit.type, opts.type),
          eq(Unit.status, "PUBLISHED"),
          eq(Unit.visibility, "PUBLIC"),
        ];
        if (opts.q) conditions.push(titleLike(opts.q));
        const where = and(...conditions);

        const rows = yield* Effect.orDie(
          db
            .select({
              id: Unit.id,
              type: Unit.type,
              slug: Unit.slug,
              status: Unit.status,
              title: UnitTranslation.title,
              createdAt: Unit.createdAt,
              updatedAt: Unit.updatedAt,
            })
            .from(Unit)
            .leftJoin(UnitTranslation, eq(Unit.id, UnitTranslation.unitId))
            .where(where)
            .orderBy(desc(Unit.createdAt))
            .limit(lim(opts.limit))
            .offset(opts.offset ?? 0),
        );

        const agg = yield* Effect.orDie(
          db
            .select({ total: count() })
            .from(Unit)
            .leftJoin(UnitTranslation, eq(Unit.id, UnitTranslation.unitId))
            .where(where),
        );

        return {
          hits: rows.map((r) => ({
            id: r.id,
            type: r.type,
            slug: r.slug,
            title: r.title ?? null,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          })),
          total: agg[0]?.total ?? 0,
        };
      });

    // -----------------------------------------------------------------------
    // User search helper (User table has its own name column)
    // 用户搜索辅助函数（User 表有自己的 name 列）
    // -----------------------------------------------------------------------

    const searchUsersQuery = (opts: {
      q?: string;
      ids?: readonly string[];
      limit?: number;
      offset?: number;
    }) =>
      Effect.gen(function* () {
        const conditions: ReturnType<typeof eq>[] = [];
        if (opts.q) {
          conditions.push(
            or(
              ilike(User.name, `%${opts.q}%`),
              ilike(User.email, `%${opts.q}%`),
            )!,
          );
        }
        if (opts.ids && opts.ids.length > 0) {
          conditions.push(inArray(User.unitId, [...opts.ids]));
        }
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const rows = yield* Effect.orDie(
          db
            .select({
              unitId: User.unitId,
              name: User.name,
              email: User.email,
              avatar: User.avatar,
              summary: User.summary,
              createdAt: User.createdAt,
            })
            .from(User)
            .where(where)
            .orderBy(desc(User.createdAt))
            .limit(lim(opts.limit))
            .offset(opts.offset ?? 0),
        );

        const agg = yield* Effect.orDie(
          db.select({ total: count() }).from(User).where(where),
        );

        return {
          users: rows.map((r) => ({
            unitId: r.unitId,
            name: r.name ?? null,
            email: r.email ?? null,
            avatar: r.avatar ?? null,
            summary: r.summary ?? null,
            createdAt: r.createdAt.toISOString(),
          })),
          total: agg[0]?.total ?? 0,
        };
      });

    // -----------------------------------------------------------------------
    // Federated search helper — queries multiple types, merges results
    // 联邦搜索辅助函数 —— 查询多种类型，合并结果
    // -----------------------------------------------------------------------

    const federatedSearch = (opts: { q?: string; limit?: number }) =>
      Effect.gen(function* () {
        const perType = Math.max(Math.floor(lim(opts.limit) / 4), 3);

        const [books, realms, posts, tags, users] = yield* Effect.all(
          [
            searchUnitsByType({ type: "BOOK", q: opts.q, limit: perType }),
            searchUnitsByType({ type: "REALM", q: opts.q, limit: perType }),
            searchUnitsByType({ type: "POST", q: opts.q, limit: perType }),
            searchUnitsByType({ type: "TAG", q: opts.q, limit: perType }),
            searchUsersQuery({ q: opts.q, limit: perType }),
          ],
          { concurrency: 5 },
        );

        return {
          hits: [
            ...books.hits.map((h) => ({ ...h, _index: "content" })),
            ...realms.hits.map((h) => ({ ...h, _index: "realms" })),
            ...posts.hits.map((h) => ({ ...h, _index: "posts" })),
            ...tags.hits.map((h) => ({ ...h, _index: "tags" })),
            ...users.users.map((u) => ({
              id: u.unitId,
              type: "USER" as const,
              slug: null,
              title: u.name,
              createdAt: u.createdAt,
              updatedAt: u.createdAt,
              _index: "users",
            })),
          ],
          totals: {
            content: books.total,
            realms: realms.total,
            posts: posts.total,
            tags: tags.total,
            users: users.total,
          },
        };
      });

    // -----------------------------------------------------------------------
    // Stub helper for admin-only Meilisearch management endpoints
    // 管理员专用 Meilisearch 管理端点的占位辅助
    // -----------------------------------------------------------------------

    const adminStub = (label: string) =>
      Effect.succeed(
        new AdminMessageResult({
          message: `${label}: stub — Meilisearch integration pending`,
        }),
      );

    const syncStub = Effect.succeed({ task: null });

    return handlers
      // ── Health & status ───────────────────────────────────────
      .handle("health", () =>
        Effect.succeed({ status: "available (database fallback)" }),
      )
      .handle("status", () =>
        Effect.succeed({ status: "database-fallback", meili: "not connected" }),
      )

      // ── Public search ─────────────────────────────────────────
      .handle("searchContent", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "BOOK", q, limit, offset });
      })

      .handle("searchUsers", ({ query }) =>
        searchUsersQuery({
          q: query.q,
          ids: query.ids ? query.ids.split(",") : undefined,
          limit: query.limit,
          offset: query.offset,
        }),
      )

      .handle("searchEntities", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "ENTITY", q, limit, offset });
      })

      .handle("searchPosts", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "POST", q, limit, offset });
      })

      .handle("searchPolls", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "POLL", q, limit, offset });
      })

      .handle("searchComments", ({ payload }) => {
        // Comments use Comment table, not Unit+Translation. Return stub shape.
        // 评论使用 Comment 表，而非 Unit+Translation。返回占位结构。
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;

        return Effect.gen(function* () {
          // Comment.content is JSON; fall back to empty when no query
          // Comment.content 是 JSON；无查询时回退为空
          if (!q) return { hits: [], total: 0 };

          const rows = yield* Effect.orDie(
            db
              .select({
                id: Comment.id,
                rootUnitId: Comment.rootUnitId,
                authorUserId: Comment.authorUserId,
                createdAt: Comment.createdAt,
              })
              .from(Comment)
              .where(
                and(
                  isNull(Comment.deletedAt),
                  sql`${Comment.content}::text ilike ${"%" + q + "%"}`,
                ),
              )
              .orderBy(desc(Comment.createdAt))
              .limit(lim(limit))
              .offset(offset ?? 0),
          );

          const agg = yield* Effect.orDie(
            db
              .select({ total: count() })
              .from(Comment)
              .where(
                and(
                  isNull(Comment.deletedAt),
                  sql`${Comment.content}::text ilike ${"%" + q + "%"}`,
                ),
              ),
          );

          return {
            hits: rows.map((r) => ({
              id: r.id,
              rootUnitId: r.rootUnitId,
              authorUserId: r.authorUserId,
              createdAt: r.createdAt.toISOString(),
            })),
            total: agg[0]?.total ?? 0,
          };
        });
      })

      .handle("searchRealms", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "REALM", q, limit, offset });
      })

      .handle("searchZones", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "ZONE", q, limit, offset });
      })

      .handle("searchTags", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "TAG", q, limit, offset });
      })

      .handle("searchLabels", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        const offset =
          typeof body["offset"] === "number" ? body["offset"] : undefined;
        return searchUnitsByType({ type: "LABEL", q, limit, offset });
      })

      .handle("searchFederated", ({ payload }) => {
        const body = payload as Record<string, unknown>;
        const q = typeof body["q"] === "string" ? body["q"] : undefined;
        const limit =
          typeof body["limit"] === "number" ? body["limit"] : undefined;
        return federatedSearch({ q, limit });
      })

      // ── Admin — index init (stubs) ───────────────────────────
      .handle("initContentIndex", () => adminStub("initContentIndex"))
      .handle("initUsersIndex", () => adminStub("initUsersIndex"))
      .handle("initPostsIndex", () => adminStub("initPostsIndex"))
      .handle("initPollsIndex", () => adminStub("initPollsIndex"))
      .handle("initRealmsIndex", () => adminStub("initRealmsIndex"))
      .handle("initZonesIndex", () => adminStub("initZonesIndex"))
      .handle("initTagsIndex", () => adminStub("initTagsIndex"))
      .handle("initLabelsIndex", () => adminStub("initLabelsIndex"))
      .handle("initEntitiesIndex", () => adminStub("initEntitiesIndex"))
      .handle("initFeedbacksIndex", () => adminStub("initFeedbacksIndex"))
      .handle("initProgressIndex", () => adminStub("initProgressIndex"))

      // ── Admin — full sync (stubs) ────────────────────────────
      .handle("syncContent", () => syncStub)
      .handle("syncUsers", () => syncStub)
      .handle("syncPosts", () => syncStub)
      .handle("syncPolls", () => syncStub)
      .handle("syncRealms", () => syncStub)
      .handle("syncZones", () => syncStub)
      .handle("syncTags", () => syncStub)
      .handle("syncLabels", () => syncStub)
      .handle("syncEntities", () => syncStub)
      .handle("syncFeedbacks", () => syncStub)

      // ── Admin — delete all (stubs) ───────────────────────────
      .handle("deleteAllContent", () => adminStub("deleteAllContent"))
      .handle("deleteAllFeedbacks", () => adminStub("deleteAllFeedbacks"))
      .handle("deleteAllUsers", () => adminStub("deleteAllUsers"))
      .handle("deleteAllPosts", () => adminStub("deleteAllPosts"))
      .handle("deleteAllPolls", () => adminStub("deleteAllPolls"))
      .handle("deleteAllRealms", () => adminStub("deleteAllRealms"))
      .handle("deleteAllZones", () => adminStub("deleteAllZones"))
      .handle("deleteAllEntities", () => adminStub("deleteAllEntities"))
      .handle("resetAllIndexes", () => adminStub("resetAllIndexes"))

      // ── Admin — key management (stubs) ────────────────────────
      .handle("createAdminKey", () =>
        Effect.succeed({ message: "stub — Meilisearch integration pending" }),
      )
      .handle("listKeys", () => Effect.succeed({ keys: [] }))
      .handle("deleteKey", () => adminStub("deleteKey"));
  }),
);
