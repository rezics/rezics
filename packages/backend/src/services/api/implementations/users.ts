import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import { Subscription, Unit, User, UserPreference } from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  UserBriefBatchResult,
  UserBriefDTO,
  UserDTO,
  UserListResult,
  UserNotFound,
} from "../interfaces/users.ts";

// ---------------------------------------------------------------------------
// Helpers / 辅助函数
// ---------------------------------------------------------------------------

/**
 * Type-guard: is the value a non-null, non-array object usable as a property bag?
 * 类型守卫：值是否为非 null、非数组对象，可用作属性包？
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safely treat an unknown payload as a string-keyed record for property inspection.
 * Effect Schema.Any payloads are pre-validated objects at runtime.
 * 将未知 payload 安全视为字符串键 record 以进行属性检查。
 * Effect Schema.Any payload 在运行时已是预验证的对象。
 */
function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

// ---------------------------------------------------------------------------
// Mappers — convert DB rows to DTOs
// 映射函数 —— 将 DB 行转换为 DTO
// ---------------------------------------------------------------------------

function userToDTO(unit: typeof Unit.$inferSelect, user: typeof User.$inferSelect) {
  return new UserDTO({
    id: user.unitId,
    name: user.name ?? undefined,
    email: user.email ?? undefined,
    image: user.avatar,
    displayName: user.name,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  });
}

function userToBriefDTO(unit: typeof Unit.$inferSelect, user: typeof User.$inferSelect) {
  return new UserBriefDTO({
    unitId: user.unitId,
    name: user.name ?? undefined,
    slug: unit.slug ?? undefined,
    summary: user.summary ?? undefined,
    avatar: user.avatar ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// Handlers — core user CRUD + brief
// 处理器 —— 核心用户 CRUD + 简要信息
// ---------------------------------------------------------------------------

export const UsersHandlers = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: fetch a User + its USER Unit by unitId
    // 共享辅助函数: 通过 unitId 获取 User + 其 USER Unit
    const fetchUserByUnitId = (unitId: string) =>
      database
          .select()
          .from(User)
          .innerJoin(Unit, eq(User.unitId, Unit.id))
          .where(and(eq(User.unitId, unitId), eq(Unit.type, "USER")))
          .limit(1)
      .pipe(Effect.map((rows) => rows[0] ?? null));

    // Shared helper: fetch a User + its USER Unit by authUserId
    // 共享辅助函数: 通过 authUserId 获取 User + 其 USER Unit
    const fetchUserByAuthId = (authUserId: string) =>
      database
          .select()
          .from(User)
          .innerJoin(Unit, eq(User.unitId, Unit.id))
          .where(and(eq(User.authUserId, authUserId), eq(Unit.type, "USER")))
          .limit(1)
      .pipe(Effect.map((rows) => rows[0] ?? null));

    // Shared helper: paginated user list
    // 共享辅助函数: 分页用户列表
    const listUsersShared = (opts: {
      search?: string;
      ids?: readonly string[];
      limit?: number;
      offset?: number;
    }) =>
      Effect.gen(function* () {
        const conditions: ReturnType<typeof eq>[] = [eq(Unit.type, "USER")];
        if (opts.ids && opts.ids.length > 0) conditions.push(inArray(User.unitId, [...opts.ids]));
        if (opts.search) conditions.push(ilike(User.name, `%${opts.search}%`));
        const where = and(...conditions);
        const rows = yield* database
            .select()
            .from(User)
            .innerJoin(Unit, eq(User.unitId, Unit.id))
            .where(where)
            .orderBy(desc(Unit.createdAt))
            .limit(lim(opts.limit))
            .offset(opts.offset ?? 0);
        const agg = yield* database.select({ total: count() }).from(User).innerJoin(Unit, eq(User.unitId, Unit.id)).where(where);
        return new UserListResult({
          users: rows.map((r) => userToDTO(r.Unit, r.User)),
          total: agg[0]?.total ?? 0,
        });
      });

    return handlers
      // ── getMe — current authenticated user profile ─────────────
      // 获取当前登录用户的资料
      .handle("getMe", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          // CurrentUser.id is the auth user ID; look up by authUserId.
          // Missing row for an authenticated user is a system defect.
          // CurrentUser.id 是 auth 用户 ID；通过 authUserId 查找。
          // 已认证用户缺少行记录属于系统缺陷。
          const row = yield* fetchUserByAuthId(currentUser.id);
          if (!row) return yield* new HttpApiError.InternalServerError();
          return userToDTO(row.Unit, row.User);
        }).pipe(Effect.orDie),
      )

      // ── getById — look up user by unit ID ──────────────────────
      // 通过 unitId 查找用户
      .handle("getById", ({ params }) =>
        Effect.gen(function* () {
          const row = yield* fetchUserByUnitId(params.userId);
          if (!row) return yield* new UserNotFound();
          return userToDTO(row.Unit, row.User);
        }).pipe(Effect.orDie),
      )

      // ── getBySlug — look up user by slug ───────────────────────
      // 通过 slug 查找用户
      .handle("getBySlug", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* database
              .select()
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(and(eq(Unit.slug, params.slug), eq(Unit.type, "USER")))
              .limit(1);
          if (!rows[0]) return yield* new UserNotFound();
          return userToDTO(rows[0].Unit, rows[0].User);
        }).pipe(Effect.orDie),
      )

      // ── updateMe — update current user profile ─────────────────
      // 更新当前用户资料
      .handle("updateMe", ({ payload }) =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const row = yield* fetchUserByAuthId(currentUser.id);
          if (!row) return yield* new HttpApiError.InternalServerError();
          const patch = toRecord(payload);
          const userSet: Record<string, unknown> = { updatedAt: new Date() };
          if ("name" in patch) userSet["name"] = patch["name"];
          if ("avatar" in patch) userSet["avatar"] = patch["avatar"];
          if ("summary" in patch) userSet["summary"] = patch["summary"];
          if ("description" in patch) userSet["description"] = patch["description"];
          yield* database.update(User).set(userSet).where(eq(User.unitId, row.User.unitId));
          yield* database.update(Unit).set({ updatedAt: new Date() }).where(eq(Unit.id, row.User.unitId));
          const updated = yield* fetchUserByUnitId(row.User.unitId);
          if (!updated) return yield* new HttpApiError.InternalServerError();
          return userToDTO(updated.Unit, updated.User);
        }).pipe(Effect.orDie),
      )

      // ── listGet — paginated user list via query params ─────────
      // 通过查询参数分页列出用户
      .handle("listGet", ({ query }) =>
        listUsersShared({
          search: query.q,
          ids: query.ids ? query.ids.split(",") : undefined,
          limit: query.limit,
          offset: query.offset,
        }).pipe(Effect.orDie),
      )

      // ── listPost — paginated user list via POST body ───────────
      // 通过 POST 请求体分页列出用户
      .handle("listPost", ({ payload }) =>
        listUsersShared({
          search: payload.q,
          ids: payload.ids ? [...payload.ids] : undefined,
          limit: payload.limit,
          offset: payload.offset,
        }).pipe(Effect.orDie),
      )

      // ── getBrief — lightweight user data for cards/avatars ─────
      // 获取用户简要信息（卡片/头像用）
      .handle("getBrief", ({ params }) =>
        Effect.gen(function* () {
          const row = yield* fetchUserByUnitId(params.userId);
          if (!row) return yield* new UserNotFound();
          return userToBriefDTO(row.Unit, row.User);
        }).pipe(Effect.orDie),
      )

      // ── batchBriefs — batch fetch multiple user briefs ─────────
      // 批量获取用户简要信息
      .handle("batchBriefs", ({ payload }) =>
        Effect.gen(function* () {
          if (payload.unitIds.length === 0) return new UserBriefBatchResult({ users: [] });
          const rows = yield* database
              .select()
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(and(eq(Unit.type, "USER"), inArray(User.unitId, [...payload.unitIds])));
          return new UserBriefBatchResult({
            users: rows.map((r) => userToBriefDTO(r.Unit, r.User)),
          });
        }).pipe(Effect.orDie),
      )

      // ── batch — batch fetch user info via query string IDs ─────
      // 通过查询字符串批量获取用户信息
      .handle("batch", ({ query }) =>
        Effect.gen(function* () {
          const ids = query.ids.split(",").filter(Boolean);
          if (ids.length === 0) return [];
          const rows = yield* database
              .select()
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(and(eq(Unit.type, "USER"), inArray(User.unitId, ids)));
          return rows.map((r) => userToDTO(r.Unit, r.User));
        }).pipe(Effect.orDie),
      )

      // ── getSettings — current user preference row ────────────
      // 获取当前用户的偏好设置行
      .handle("getSettings", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const row = yield* fetchUserByAuthId(currentUser.id);
          if (!row) return yield* new HttpApiError.InternalServerError();
          const prefs = yield* database
              .select()
              .from(UserPreference)
              .where(eq(UserPreference.userId, row.User.unitId))
              .limit(1);
          const pref = prefs[0];
          return {
            defaultLicenseSlug: pref?.defaultLicenseSlug ?? null,
            realmManageModeDefault: pref?.realmManageModeDefault ?? null,
            bookshelfConfig: pref?.bookshelfConfig ?? null,
          };
        }).pipe(Effect.orDie),
      )

      // ── updateSettings — upsert current user preferences ──────
      // 更新/插入当前用户偏好设置
      .handle("updateSettings", ({ payload }) =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const row = yield* fetchUserByAuthId(currentUser.id);
          if (!row) return yield* new HttpApiError.InternalServerError();
          const userId = row.User.unitId;
          const patch = toRecord(payload);
          const set: typeof UserPreference.$inferInsert = {
            userId,
            updatedAt: new Date(),
          };
          if ("defaultLicenseSlug" in patch) {
            const v = patch["defaultLicenseSlug"];
            set.defaultLicenseSlug = typeof v === "string" ? v : null;
          }
          if ("realmManageModeDefault" in patch) {
            const v = patch["realmManageModeDefault"];
            set.realmManageModeDefault = typeof v === "boolean" ? v : null;
          }
          if ("bookshelfConfig" in patch)
            set.bookshelfConfig = patch["bookshelfConfig"];
          yield* database
              .insert(UserPreference)
              .values(set)
              .onConflictDoUpdate({
                target: UserPreference.userId,
                set: {
                  defaultLicenseSlug: set.defaultLicenseSlug,
                  realmManageModeDefault: set.realmManageModeDefault,
                  bookshelfConfig: set.bookshelfConfig,
                  updatedAt: new Date(),
                },
              });
          const prefs = yield* database
              .select()
              .from(UserPreference)
              .where(eq(UserPreference.userId, userId))
              .limit(1);
          const pref = prefs[0];
          return {
            defaultLicenseSlug: pref?.defaultLicenseSlug ?? null,
            realmManageModeDefault: pref?.realmManageModeDefault ?? null,
            bookshelfConfig: pref?.bookshelfConfig ?? null,
          };
        }).pipe(Effect.orDie),
      )

      // ── getEmailVerification — check email verification status ─
      // 检查邮件验证状态
      .handle("getEmailVerification", () =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const row = yield* fetchUserByAuthId(currentUser.id);
          if (!row) return yield* new HttpApiError.InternalServerError();
          return {
            email: row.User.email ?? currentUser.email,
            emailVerified: currentUser.emailVerified,
          };
        }).pipe(Effect.orDie),
      )

      // ── getFollowers — paginated list of users who follow this user ─
      // 获取关注该用户的用户分页列表
      .handle("getFollowers", ({ params, query }) =>
        Effect.gen(function* () {
          const page = query.page ?? 1;
          const limit = lim(query.limit);
          const offset = (page - 1) * limit;

          // Find subscriptions where subscribedUnitId = target user,
          // join to get subscriber user info, filtered to USER units only.
          // 查找 subscribedUnitId = 目标用户 的订阅记录，
          // 连接获取订阅者用户信息，仅筛选 USER 类型。
          const rows = yield* database
              .select()
              .from(Subscription)
              .innerJoin(User, eq(Subscription.subscriberUnitId, User.unitId))
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(
                and(
                  eq(Subscription.subscribedUnitId, params.userId),
                  eq(Unit.type, "USER"),
                ),
              )
              .orderBy(desc(Subscription.createdAt))
              .limit(limit)
              .offset(offset);

          const agg = yield* database
              .select({ total: count() })
              .from(Subscription)
              .innerJoin(Unit, eq(Subscription.subscriberUnitId, Unit.id))
              .where(
                and(
                  eq(Subscription.subscribedUnitId, params.userId),
                  eq(Unit.type, "USER"),
                ),
              );

          return new UserListResult({
            users: rows.map((r) => userToDTO(r.Unit, r.User)),
            total: agg[0]?.total ?? 0,
          });
        }).pipe(Effect.orDie),
      )

      // ── getFollowings — paginated list of users this user follows ─
      // 获取该用户关注的用户分页列表
      .handle("getFollowings", ({ params, query }) =>
        Effect.gen(function* () {
          const page = query.page ?? 1;
          const limit = lim(query.limit);
          const offset = (page - 1) * limit;

          // Find subscriptions where subscriberUnitId = target user,
          // join to get subscribed user info, filtered to USER units only.
          // 查找 subscriberUnitId = 目标用户 的订阅记录，
          // 连接获取被关注用户信息，仅筛选 USER 类型。
          const rows = yield* database
              .select()
              .from(Subscription)
              .innerJoin(User, eq(Subscription.subscribedUnitId, User.unitId))
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(
                and(
                  eq(Subscription.subscriberUnitId, params.userId),
                  eq(Unit.type, "USER"),
                ),
              )
              .orderBy(desc(Subscription.createdAt))
              .limit(limit)
              .offset(offset);

          const agg = yield* database
              .select({ total: count() })
              .from(Subscription)
              .innerJoin(Unit, eq(Subscription.subscribedUnitId, Unit.id))
              .where(
                and(
                  eq(Subscription.subscriberUnitId, params.userId),
                  eq(Unit.type, "USER"),
                ),
              );

          return new UserListResult({
            users: rows.map((r) => userToDTO(r.Unit, r.User)),
            total: agg[0]?.total ?? 0,
          });
        }).pipe(Effect.orDie),
      )

      // ── Stubs — admin + account management, not yet implemented ─
      // 桩 —— 管理员 + 账号管理，尚未实现
      .handle("requestEmailVerification", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      )
      .handle("exportData", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      )
      .handle("deleteAccount", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      )
      .handle("adminGet", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      )
      .handle("adminUpdate", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      )
      .handle("adminDelete", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      );
  }),
);

export const ProfileHandlers = HttpApiBuilder.group(
  Api,
  "profile",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("reactionGiven", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      )
      .handle("reactionReceived", () =>
        Effect.gen(function* () {
          return yield* new HttpApiError.InternalServerError();
        }).pipe(Effect.orDie),
      );
  }),
);
