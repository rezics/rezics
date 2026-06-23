import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import { Unit, User } from "../../database/schema/all.ts";
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
    const db = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // Shared helper: fetch a User + its USER Unit by unitId
    // 共享辅助函数: 通过 unitId 获取 User + 其 USER Unit
    const fetchUserByUnitId = (unitId: string) =>
      Effect.orDie(
        db
          .select()
          .from(User)
          .innerJoin(Unit, eq(User.unitId, Unit.id))
          .where(and(eq(User.unitId, unitId), eq(Unit.type, "USER")))
          .limit(1),
      ).pipe(Effect.map((rows) => rows[0] ?? null));

    // Shared helper: fetch a User + its USER Unit by authUserId
    // 共享辅助函数: 通过 authUserId 获取 User + 其 USER Unit
    const fetchUserByAuthId = (authUserId: string) =>
      Effect.orDie(
        db
          .select()
          .from(User)
          .innerJoin(Unit, eq(User.unitId, Unit.id))
          .where(and(eq(User.authUserId, authUserId), eq(Unit.type, "USER")))
          .limit(1),
      ).pipe(Effect.map((rows) => rows[0] ?? null));

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
        const rows = yield* Effect.orDie(
          db
            .select()
            .from(User)
            .innerJoin(Unit, eq(User.unitId, Unit.id))
            .where(where)
            .orderBy(desc(Unit.createdAt))
            .limit(lim(opts.limit))
            .offset(opts.offset ?? 0),
        );
        const agg = yield* Effect.orDie(
          db.select({ total: count() }).from(User).innerJoin(Unit, eq(User.unitId, Unit.id)).where(where),
        );
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
          if (!row) return yield* Effect.die(new Error(`User row missing for auth user ${currentUser.id}`));
          return userToDTO(row.Unit, row.User);
        }),
      )

      // ── getById — look up user by unit ID ──────────────────────
      // 通过 unitId 查找用户
      .handle("getById", ({ params }) =>
        Effect.gen(function* () {
          const row = yield* fetchUserByUnitId(params.userId);
          if (!row) return yield* new UserNotFound();
          return userToDTO(row.Unit, row.User);
        }),
      )

      // ── getBySlug — look up user by slug ───────────────────────
      // 通过 slug 查找用户
      .handle("getBySlug", ({ params }) =>
        Effect.gen(function* () {
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(and(eq(Unit.slug, params.slug), eq(Unit.type, "USER")))
              .limit(1),
          );
          if (!rows[0]) return yield* new UserNotFound();
          return userToDTO(rows[0].Unit, rows[0].User);
        }),
      )

      // ── updateMe — update current user profile ─────────────────
      // 更新当前用户资料
      .handle("updateMe", ({ payload }) =>
        Effect.gen(function* () {
          const currentUser = yield* CurrentUser;
          const row = yield* fetchUserByAuthId(currentUser.id);
          if (!row) return yield* Effect.die(new Error(`User row missing for auth user ${currentUser.id}`));
          const patch = payload as Record<string, unknown>;
          const userSet: Record<string, unknown> = { updatedAt: new Date() };
          if ("name" in patch) userSet["name"] = patch["name"];
          if ("avatar" in patch) userSet["avatar"] = patch["avatar"];
          if ("summary" in patch) userSet["summary"] = patch["summary"];
          if ("description" in patch) userSet["description"] = patch["description"];
          yield* Effect.orDie(
            db.update(User).set(userSet).where(eq(User.unitId, row.User.unitId)),
          );
          yield* Effect.orDie(
            db.update(Unit).set({ updatedAt: new Date() }).where(eq(Unit.id, row.User.unitId)),
          );
          const updated = yield* fetchUserByUnitId(row.User.unitId);
          if (!updated) return yield* Effect.die(new Error(`User row vanished during update for ${row.User.unitId}`));
          return userToDTO(updated.Unit, updated.User);
        }),
      )

      // ── listGet — paginated user list via query params ─────────
      // 通过查询参数分页列出用户
      .handle("listGet", ({ query }) =>
        listUsersShared({
          search: query.q,
          ids: query.ids ? query.ids.split(",") : undefined,
          limit: query.limit,
          offset: query.offset,
        }),
      )

      // ── listPost — paginated user list via POST body ───────────
      // 通过 POST 请求体分页列出用户
      .handle("listPost", ({ payload }) =>
        listUsersShared({
          search: payload.q,
          ids: payload.ids ? [...payload.ids] : undefined,
          limit: payload.limit,
          offset: payload.offset,
        }),
      )

      // ── getBrief — lightweight user data for cards/avatars ─────
      // 获取用户简要信息（卡片/头像用）
      .handle("getBrief", ({ params }) =>
        Effect.gen(function* () {
          const row = yield* fetchUserByUnitId(params.userId);
          if (!row) return yield* new UserNotFound();
          return userToBriefDTO(row.Unit, row.User);
        }),
      )

      // ── batchBriefs — batch fetch multiple user briefs ─────────
      // 批量获取用户简要信息
      .handle("batchBriefs", ({ payload }) =>
        Effect.gen(function* () {
          if (payload.unitIds.length === 0) return new UserBriefBatchResult({ users: [] });
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(and(eq(Unit.type, "USER"), inArray(User.unitId, [...payload.unitIds]))),
          );
          return new UserBriefBatchResult({
            users: rows.map((r) => userToBriefDTO(r.Unit, r.User)),
          });
        }),
      )

      // ── batch — batch fetch user info via query string IDs ─────
      // 通过查询字符串批量获取用户信息
      .handle("batch", ({ query }) =>
        Effect.gen(function* () {
          const ids = query.ids.split(",").filter(Boolean);
          if (ids.length === 0) return [];
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(and(eq(Unit.type, "USER"), inArray(User.unitId, ids))),
          );
          return rows.map((r) => userToDTO(r.Unit, r.User));
        }),
      )

      // ── Stubs — remaining endpoints not yet implemented ────────
      // 桩 —— 尚未实现的其余端点
      .handle("getSettings", () => Effect.die("TODO: not implemented"))
      .handle("updateSettings", () => Effect.die("TODO: not implemented"))
      .handle("getEmailVerification", () => Effect.die("TODO: not implemented"))
      .handle("requestEmailVerification", () => Effect.die("TODO: not implemented"))
      .handle("exportData", () => Effect.die("TODO: not implemented"))
      .handle("deleteAccount", () => Effect.die("TODO: not implemented"))
      .handle("adminGet", () => Effect.die("TODO: not implemented"))
      .handle("adminUpdate", () => Effect.die("TODO: not implemented"))
      .handle("adminDelete", () => Effect.die("TODO: not implemented"))
      .handle("getFollowers", () => Effect.die("TODO: not implemented"))
      .handle("getFollowings", () => Effect.die("TODO: not implemented"));
  }),
);

export const ProfileHandlers = HttpApiBuilder.group(
  Api,
  "profile",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("reactionGiven", () => Effect.die("TODO: not implemented"))
      .handle("reactionReceived", () => Effect.die("TODO: not implemented"));
  }),
);
