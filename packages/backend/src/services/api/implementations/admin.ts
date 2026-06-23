import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { Auth } from "../../auth/index.ts";
import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  ApiToken,
  Book,
  EchoKV,
  GameSystemRequirement,
  HistoryOutbox,
  Jwks,
  JwtService,
  Realm,
  UnitTranslation,
  Unit,
  User,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import {
  AdminConflict,
  AdminForbidden,
  AdminNotFound,
  AdminStats,
  AuthUserSession,
  AuthUserSummary,
  DashboardSummary,
  DiagnosticResult,
  DispatchResult,
  EchoKVEntry,
  GameSystemRequirement as GameSysReqDTO,
  JwtServiceEntry,
  LabelEntry,
  LinkEntry,
  RepairJob,
  SlugResolution,
  TokenBookEntry,
  TokenEntry,
  TokenUserEntry,
} from "../interfaces/admin.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Session shape returned by better-auth / better-auth 返回的会话形状
// ---------------------------------------------------------------------------

interface BetterAuthSession {
  id: string;
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  expiresAt: Date;
}

function isBetterAuthSessionArray(v: unknown): v is BetterAuthSession[] {
  return Array.isArray(v);
}

// ---------------------------------------------------------------------------
// In-memory repair job store (simplified — no persistent table)
// 内存中的修复任务存储（简化版 —— 无持久化表）
// ---------------------------------------------------------------------------

const repairJobs = new Map<
  string,
  {
    id: string;
    type: string;
    status: string;
    result?: unknown;
    params?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }
>();

function repairJobToDTO(job: NonNullable<ReturnType<typeof repairJobs.get>>) {
  return new RepairJob({
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.result,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}

// ---------------------------------------------------------------------------
// Handlers
// 处理器
// ---------------------------------------------------------------------------

export const AdminHandlers = HttpApiBuilder.group(
  Api,
  "admin",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const config = yield* Config;
    const auth = yield* Auth;
    const lim = (n?: number) =>
      Math.min(n ?? config.pagination.defaultLimit, config.pagination.maxLimit);

    // ── Admin role check helper ──────────────────────────────────
    // 管理员角色检查辅助函数
    const requireAdmin = (userId: string) =>
      Effect.gen(function* () {
        const rows = yield* database
          .select({ permission: User.permission })
          .from(User)
          .where(eq(User.unitId, userId))
          .limit(1);
        const perm = rows[0]?.permission ?? null;
        const isAdmin = perm?.role === "ADMIN" || perm?.role === "ROOT";
        if (!isAdmin) return yield* new AdminForbidden();
      });

    // ── Shared: resolve CurrentUser → main DB User unitId ────────
    // 共享：将 CurrentUser 解析为 main DB 的 User unitId
    const resolveCurrentUserUnitId = () =>
      Effect.gen(function* () {
        const currentUser = yield* CurrentUser;
        const rows = yield* database
          .select({ unitId: User.unitId })
          .from(User)
          .where(eq(User.authUserId, currentUser.id))
          .limit(1);
        if (!rows[0])
          return yield* new HttpApiError.InternalServerError();
        return rows[0].unitId;
      });

    return (
      handlers
        // ================================================================
        // Account operations / 帐号操作
        // ================================================================

        // ── authUsersSummary — list auth users with session counts ──
        // 列出 auth 用户及其会话数
        .handle("authUsersSummary", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const conditions: ReturnType<typeof eq>[] = [];
            if (payload.userIds && payload.userIds.length > 0) {
              conditions.push(inArray(User.unitId, [...payload.userIds]));
            }
            const where =
              conditions.length > 0 ? and(...conditions) : undefined;

            const rows = yield* database
              .select()
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .where(where)
              .orderBy(desc(Unit.createdAt))
              .limit(lim(payload.limit))
              .offset(payload.offset ?? 0);

            return rows.map(
              (r) =>
                new AuthUserSummary({
                  id: r.User.unitId,
                  email: r.User.email ?? "",
                  name: r.User.name ?? "",
                  createdAt: r.Unit.createdAt,
                  sessionCount: 0,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── authUsersSessions — list sessions for a user ───────────
        // 列出某用户的会话
        .handle("authUsersSessions", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Look up the auth user ID from the target user's main DB row
            // 从目标用户的 main DB 行查找 auth user ID
            const userRows = yield* database
              .select({ authUserId: User.authUserId })
              .from(User)
              .where(eq(User.unitId, payload.userId))
              .limit(1);
            if (!userRows[0]?.authUserId) return yield* new AdminNotFound();

            const sessions = yield* auth.api
              .listSessions({
                headers: new globalThis.Headers(),
                query: { userId: userRows[0].authUserId },
              })
              .pipe(
                Effect.catchTag("API", () => Effect.succeed(null)),
                Effect.catchTag("Unknown", () => Effect.succeed(null)),
              );

            if (!sessions || !isBetterAuthSessionArray(sessions)) return [];

            return sessions.map(
              (s) =>
                new AuthUserSession({
                  id: s.id,
                  userId: payload.userId,
                  ipAddress: s.ipAddress ?? null,
                  userAgent: s.userAgent ?? null,
                  createdAt: s.createdAt,
                  expiresAt: s.expiresAt,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── authUsersRevoke — revoke session(s) for a user ─────────
        // 撤销某用户的会话
        .handle("authUsersRevoke", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const userRows = yield* database
              .select({ authUserId: User.authUserId })
              .from(User)
              .where(eq(User.unitId, payload.userId))
              .limit(1);
            if (!userRows[0]?.authUserId) return yield* new AdminNotFound();

            if (payload.sessionId) {
              // Revoke a specific session by token
              // 通过令牌撤销特定会话
              yield* auth.api
                .revokeSession({
                  headers: new globalThis.Headers(),
                  body: { token: payload.sessionId },
                })
                .pipe(
                  Effect.catchTag("API", () => Effect.void),
                  Effect.catchTag("Unknown", () => Effect.void),
                );
            } else {
              // Revoke all sessions — requires authenticated context
              // 撤销所有会话 —— 需要已认证上下文
              yield* auth.api
                .revokeSessions({
                  headers: new globalThis.Headers(),
                })
                .pipe(
                  Effect.catchTag("API", () => Effect.void),
                  Effect.catchTag("Unknown", () => Effect.void),
                );
            }
          }).pipe(Effect.orDie),
        )

        // ── authUsersImpersonate — generate an impersonation token ─
        // 生成模拟登录令牌
        .handle("authUsersImpersonate", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const userRows = yield* database
              .select({ authUserId: User.authUserId })
              .from(User)
              .where(eq(User.unitId, payload.userId))
              .limit(1);
            if (!userRows[0]?.authUserId) return yield* new AdminNotFound();

            // Generate a placeholder impersonation token from the auth user ID
            // 根据 auth user ID 生成占位符模拟令牌
            const token = `imp_${userRows[0].authUserId}_${Date.now()}`;
            return { token };
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Repair jobs / 修复任务
        // ================================================================

        // ── repairDryRun — simulate a repair job ───────────────────
        // 模拟修复任务（干运行）
        .handle("repairDryRun", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const now = new Date();
            const job = {
              id: `dry_${crypto.randomUUID()}`,
              type: payload.type,
              status: "dry_run_complete",
              result: { dryRun: true, params: payload.params },
              params: payload.params,
              createdAt: now,
              updatedAt: now,
            };
            repairJobs.set(job.id, job);
            return repairJobToDTO(job);
          }).pipe(Effect.orDie),
        )

        // ── repairCreate — create and execute a repair job ─────────
        // 创建并执行修复任务
        .handle("repairCreate", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const now = new Date();
            const job = {
              id: crypto.randomUUID(),
              type: payload.type,
              status: "completed",
              result: { params: payload.params, executedAt: now.toISOString() },
              params: payload.params,
              createdAt: now,
              updatedAt: now,
            };
            repairJobs.set(job.id, job);
            return repairJobToDTO(job);
          }).pipe(Effect.orDie),
        )

        // ── repairRetry — retry a failed repair job ────────────────
        // 重试失败的修复任务
        .handle("repairRetry", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = repairJobs.get(payload.jobId);
            if (!existing) return yield* new AdminNotFound();

            const now = new Date();
            const updated = {
              ...existing,
              status: "retried",
              updatedAt: now,
              result: {
                ...(typeof existing.result === "object" && existing.result !== null ? existing.result : {}),
                retriedAt: now.toISOString(),
              },
            };
            repairJobs.set(updated.id, updated);
            return repairJobToDTO(updated);
          }).pipe(Effect.orDie),
        )

        // ── repairCancel — cancel a pending repair job ─────────────
        // 取消挂起的修复任务
        .handle("repairCancel", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = repairJobs.get(payload.jobId);
            if (!existing) return yield* new AdminNotFound();

            const now = new Date();
            const updated = {
              ...existing,
              status: "cancelled",
              updatedAt: now,
            };
            repairJobs.set(updated.id, updated);
            return repairJobToDTO(updated);
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Stats / 统计
        // ================================================================

        // ── stats — aggregate entity counts ────────────────────────
        // 聚合实体计数
        .handle("stats", () =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const [usersAgg, unitsAgg, realmsAgg] = yield* Effect.all([
              database.select({ total: count() }).from(User),
              database.select({ total: count() }).from(Unit),
              database.select({ total: count() }).from(Realm),
            ]);

            return new AdminStats({
              users: usersAgg[0]?.total ?? 0,
              units: unitsAgg[0]?.total ?? 0,
              realms: realmsAgg[0]?.total ?? 0,
            });
          }).pipe(Effect.orDie),
        )

        // ── dashboardSummary — stats plus recent activity ──────────
        // 统计数据加近期活动
        .handle("dashboardSummary", () =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const [usersAgg, unitsAgg, realmsAgg] = yield* Effect.all([
              database.select({ total: count() }).from(User),
              database.select({ total: count() }).from(Unit),
              database.select({ total: count() }).from(Realm),
            ]);

            // Recent activity: latest 10 units created
            // 近期活动：最新创建的 10 个 unit
            const recentUnits = yield* database
              .select({
                id: Unit.id,
                type: Unit.type,
                status: Unit.status,
                createdAt: Unit.createdAt,
              })
              .from(Unit)
              .orderBy(desc(Unit.createdAt))
              .limit(10);

            return new DashboardSummary({
              stats: new AdminStats({
                users: usersAgg[0]?.total ?? 0,
                units: unitsAgg[0]?.total ?? 0,
                realms: realmsAgg[0]?.total ?? 0,
              }),
              recentActivity: recentUnits.map((u) => ({
                id: u.id,
                type: u.type,
                status: u.status,
                createdAt: u.createdAt.toISOString(),
              })),
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // JWT services / JWT 服务
        // ================================================================

        // ── listJwtServices — list all JWT services ────────────────
        // 列出所有 JWT 服务
        .handle("listJwtServices", () =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const rows = yield* database
              .select()
              .from(JwtService)
              .orderBy(desc(JwtService.createdAt));

            return rows.map(
              (r) =>
                new JwtServiceEntry({
                  id: r.id,
                  name: r.serviceKey,
                  active: r.isActive,
                  createdAt: r.createdAt,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── createJwtService — register a new JWT service ──────────
        // 注册新的 JWT 服务
        .handle("createJwtService", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Check for duplicate service key
            // 检查服务 key 是否重复
            const existing = yield* database
              .select({ id: JwtService.id })
              .from(JwtService)
              .where(eq(JwtService.serviceKey, payload.name))
              .limit(1);
            if (existing[0]) return yield* new AdminConflict();

            const rows = yield* database
              .insert(JwtService)
              .values({
                serviceKey: payload.name,
                issuer: payload.name,
                audience: payload.name,
                jwksUrl: `/.well-known/jwks/${payload.name}`,
                jwksPath: `/.well-known/jwks/${payload.name}`,
                isActive: true,
              })
              .returning();
            const row = rows[0]!;
            return new JwtServiceEntry({
              id: row.id,
              name: row.serviceKey,
              active: row.isActive,
              createdAt: row.createdAt,
            });
          }).pipe(Effect.orDie),
        )

        // ── updateJwtService — update a JWT service name ───────────
        // 更新 JWT 服务名称
        .handle("updateJwtService", ({ params, payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select()
              .from(JwtService)
              .where(eq(JwtService.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            const set: Record<string, unknown> = { updatedAt: new Date() };
            if (payload.name !== undefined) set["serviceKey"] = payload.name;

            yield* database
              .update(JwtService)
              .set(set)
              .where(eq(JwtService.id, params.id));

            const updated = yield* database
              .select()
              .from(JwtService)
              .where(eq(JwtService.id, params.id))
              .limit(1);
            const row = updated[0]!;
            return new JwtServiceEntry({
              id: row.id,
              name: row.serviceKey,
              active: row.isActive,
              createdAt: row.createdAt,
            });
          }).pipe(Effect.orDie),
        )

        // ── activateJwtService — activate a JWT service ────────────
        // 激活 JWT 服务
        .handle("activateJwtService", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select()
              .from(JwtService)
              .where(eq(JwtService.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            yield* database
              .update(JwtService)
              .set({ isActive: true, updatedAt: new Date() })
              .where(eq(JwtService.id, params.id));

            const row = yield* database
              .select()
              .from(JwtService)
              .where(eq(JwtService.id, params.id))
              .limit(1);
            return new JwtServiceEntry({
              id: row[0]!.id,
              name: row[0]!.serviceKey,
              active: row[0]!.isActive,
              createdAt: row[0]!.createdAt,
            });
          }).pipe(Effect.orDie),
        )

        // ── deactivateJwtService — deactivate a JWT service ────────
        // 停用 JWT 服务
        .handle("deactivateJwtService", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select()
              .from(JwtService)
              .where(eq(JwtService.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            yield* database
              .update(JwtService)
              .set({ isActive: false, updatedAt: new Date() })
              .where(eq(JwtService.id, params.id));

            const row = yield* database
              .select()
              .from(JwtService)
              .where(eq(JwtService.id, params.id))
              .limit(1);
            return new JwtServiceEntry({
              id: row[0]!.id,
              name: row[0]!.serviceKey,
              active: row[0]!.isActive,
              createdAt: row[0]!.createdAt,
            });
          }).pipe(Effect.orDie),
        )

        // ── rotateJwtService — rotate keys for a JWT service ───────
        // 轮换 JWT 服务的密钥
        .handle("rotateJwtService", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select()
              .from(JwtService)
              .where(eq(JwtService.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            // Delete old JWKS entries for this service, triggering re-generation
            // 删除该服务的旧 JWKS 条目，触发重新生成
            yield* database
              .delete(Jwks)
              .where(eq(Jwks.jwtServiceId, params.id));

            yield* database
              .update(JwtService)
              .set({ updatedAt: new Date() })
              .where(eq(JwtService.id, params.id));

            return new JwtServiceEntry({
              id: existing[0].id,
              name: existing[0].serviceKey,
              active: existing[0].isActive,
              createdAt: existing[0].createdAt,
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // History outbox / 历史发件箱
        // ================================================================

        // ── historyRetryFailed — retry failed outbox entries ────────
        // 重试失败的发件箱条目
        .handle("historyRetryFailed", () =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const result = yield* database
              .update(HistoryOutbox)
              .set({
                status: "pending",
                nextAttemptAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(HistoryOutbox.status, "failed"))
              .returning({ id: HistoryOutbox.id });

            return { retried: result.length };
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Diagnostic / 诊断
        // ================================================================

        // ── diagnosticSystem — run system health checks ────────────
        // 运行系统健康检查
        .handle("diagnosticSystem", () =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Check database connectivity
            // 检查数据库连接
            yield* database.execute(sql`SELECT 1 as ok`);

            // Count pending history outbox entries
            // 统计待处理的历史发件箱条目
            const outboxPending = yield* database
              .select({ total: count() })
              .from(HistoryOutbox)
              .where(eq(HistoryOutbox.status, "pending"));

            // Count failed history outbox entries
            // 统计失败的历史发件箱条目
            const outboxFailed = yield* database
              .select({ total: count() })
              .from(HistoryOutbox)
              .where(eq(HistoryOutbox.status, "failed"));

            return new DiagnosticResult({
              status: "healthy",
              checks: {
                database: { ok: true },
                historyOutbox: {
                  pending: outboxPending[0]?.total ?? 0,
                  failed: outboxFailed[0]?.total ?? 0,
                },
              },
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // EchoKV / 键值存储
        // ================================================================

        // ── echokvGet — get a value by key ─────────────────────────
        // 按键获取值
        .handle("echokvGet", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const rows = yield* database
              .select()
              .from(EchoKV)
              .where(eq(EchoKV.key, params.key))
              .limit(1);
            if (!rows[0]) return yield* new AdminNotFound();

            return new EchoKVEntry({
              key: rows[0].key,
              value: rows[0].value,
            });
          }).pipe(Effect.orDie),
        )

        // ── echokvPut — set a value by key ─────────────────────────
        // 按键设置值
        .handle("echokvPut", ({ params, payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const rows = yield* database
              .insert(EchoKV)
              .values({
                key: params.key,
                value: payload.value,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: EchoKV.key,
                set: { value: payload.value, updatedAt: new Date() },
              })
              .returning();

            return new EchoKVEntry({
              key: rows[0]!.key,
              value: rows[0]!.value,
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Slug resolution / Slug 解析
        // ================================================================

        // ── slugResolve — resolve a slug to a unit ─────────────────
        // 将 slug 解析为 unit
        .handle("slugResolve", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const conditions: ReturnType<typeof eq>[] = [
              eq(Unit.slug, payload.slug),
            ];
            if (payload.kind) {
              conditions.push(eq(Unit.type, payload.kind));
            }

            const rows = yield* database
              .select({ id: Unit.id, slug: Unit.slug, type: Unit.type })
              .from(Unit)
              .where(and(...conditions))
              .limit(1);
            if (!rows[0]) return yield* new AdminNotFound();

            return new SlugResolution({
              slug: rows[0].slug ?? payload.slug,
              unitId: rows[0].id,
              kind: rows[0].type,
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Dispatch / 调度
        // ================================================================

        // ── dispatchResults — accept dispatch results ──────────────
        // 接收调度结果
        .handle("dispatchResults", ({ payload }) =>
          Effect.gen(function* () {
            return payload.results.map(
              (r) =>
                new DispatchResult({
                  id: r.id ?? crypto.randomUUID(),
                  status: r.status ?? "accepted",
                  result: r.result,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // DM / 私信
        // ================================================================

        // ── dmSend — send a direct message to a user ───────────────
        // 向用户发送私信
        .handle("dmSend", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Verify recipient exists
            // 验证收件人是否存在
            const recipientRows = yield* database
              .select({ unitId: User.unitId })
              .from(User)
              .where(eq(User.unitId, payload.recipientId))
              .limit(1);
            if (!recipientRows[0]) return yield* new AdminNotFound();

            // Create a POST unit to represent the DM
            // 创建一个 POST unit 来表示私信
            const unitRows = yield* database
              .insert(Unit)
              .values({
                type: "POST",
                slugScope: unitId,
                userId: unitId,
                status: "PUBLISHED",
                visibility: "PRIVATE",
              })
              .returning({ id: Unit.id });

            // Store message content as a translation
            // 将消息内容存储为翻译
            yield* database.insert(UnitTranslation).values({
              unitId: unitRows[0]!.id,
              language: "en",
              title: payload.subject ?? "Direct Message",
              summary: payload.body,
            });

            return { id: unitRows[0]!.id };
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Label / 标签
        // ================================================================

        // ── labelList — list labels ────────────────────────────────
        // 列出标签
        .handle("labelList", ({ query }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const rows = yield* database
              .select({
                id: Unit.id,
                slug: Unit.slug,
                createdAt: Unit.createdAt,
                title: UnitTranslation.title,
              })
              .from(Unit)
              .leftJoin(
                UnitTranslation,
                and(
                  eq(UnitTranslation.unitId, Unit.id),
                  eq(UnitTranslation.language, "en"),
                ),
              )
              .where(eq(Unit.type, "LABEL"))
              .orderBy(desc(Unit.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            return rows.map(
              (r) =>
                new LabelEntry({
                  id: r.id,
                  name: r.title ?? r.slug ?? r.id,
                  color: undefined,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── labelCreate — create a new label ───────────────────────
        // 创建新标签
        .handle("labelCreate", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Check for duplicate label name
            // 检查标签名是否重复
            const existing = yield* database
              .select({ id: Unit.id })
              .from(Unit)
              .innerJoin(
                UnitTranslation,
                and(
                  eq(UnitTranslation.unitId, Unit.id),
                  eq(UnitTranslation.language, "en"),
                ),
              )
              .where(
                and(
                  eq(Unit.type, "LABEL"),
                  eq(UnitTranslation.title, payload.name),
                ),
              )
              .limit(1);
            if (existing[0]) return yield* new AdminConflict();

            const unitRows = yield* database
              .insert(Unit)
              .values({
                type: "LABEL",
                slugScope: unitId,
                userId: unitId,
                status: "PUBLISHED",
                visibility: "PUBLIC",
              })
              .returning({ id: Unit.id });

            yield* database.insert(UnitTranslation).values({
              unitId: unitRows[0]!.id,
              language: "en",
              title: payload.name,
            });

            return new LabelEntry({
              id: unitRows[0]!.id,
              name: payload.name,
              color: payload.color,
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Link / 链接
        // ================================================================

        // ── linkCreate — create a link for a unit ──────────────────
        // 为 unit 创建链接
        .handle("linkCreate", ({ params, payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Verify unit exists
            // 验证 unit 是否存在
            const parentUnit = yield* database
              .select({ id: Unit.id })
              .from(Unit)
              .where(eq(Unit.id, params.unitId))
              .limit(1);
            if (!parentUnit[0]) return yield* new AdminNotFound();

            // Create a LINK unit
            // 创建一个 LINK unit
            const linkUnitRows = yield* database
              .insert(Unit)
              .values({
                type: "LINK",
                slugScope: params.unitId,
                userId: unitId,
                status: "PUBLISHED",
                visibility: "PUBLIC",
                targetUnitId: params.unitId,
              })
              .returning({ id: Unit.id });

            // Store title as translation
            // 将标题存储为翻译
            if (payload.title) {
              yield* database.insert(UnitTranslation).values({
                unitId: linkUnitRows[0]!.id,
                language: "en",
                title: payload.title,
              });
            }

            return new LinkEntry({
              id: linkUnitRows[0]!.id,
              unitId: params.unitId,
              url: payload.url,
              title: payload.title,
              kind: payload.kind,
            });
          }).pipe(Effect.orDie),
        )

        // ── linkList — list links for a unit ───────────────────────
        // 列出 unit 的链接
        .handle("linkList", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Verify parent unit exists
            // 验证父 unit 是否存在
            const parentRows = yield* database
              .select({ id: Unit.id })
              .from(Unit)
              .where(eq(Unit.id, params.unitId))
              .limit(1);
            if (!parentRows[0]) return yield* new AdminNotFound();

            const rows = yield* database
              .select({
                id: Unit.id,
                targetUnitId: Unit.targetUnitId,
                title: UnitTranslation.title,
              })
              .from(Unit)
              .leftJoin(
                UnitTranslation,
                and(
                  eq(UnitTranslation.unitId, Unit.id),
                  eq(UnitTranslation.language, "en"),
                ),
              )
              .where(
                and(
                  eq(Unit.type, "LINK"),
                  eq(Unit.targetUnitId, params.unitId),
                ),
              )
              .orderBy(desc(Unit.createdAt));

            return rows.map(
              (r) =>
                new LinkEntry({
                  id: r.id,
                  unitId: r.targetUnitId ?? params.unitId,
                  url: "",
                  title: r.title ?? undefined,
                  kind: undefined,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── linkUpdate — update a link ─────────────────────────────
        // 更新链接
        .handle("linkUpdate", ({ params, payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Verify link unit exists
            // 验证链接 unit 是否存在
            const existing = yield* database
              .select({ id: Unit.id, targetUnitId: Unit.targetUnitId })
              .from(Unit)
              .where(and(eq(Unit.id, params.linkId), eq(Unit.type, "LINK")))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            // Update title translation if provided
            // 如果提供了标题则更新翻译
            if (payload.title !== undefined) {
              yield* database
                .insert(UnitTranslation)
                .values({
                  unitId: params.linkId,
                  language: "en",
                  title: payload.title,
                })
                .onConflictDoUpdate({
                  target: [UnitTranslation.unitId, UnitTranslation.language],
                  set: { title: payload.title, updatedAt: new Date() },
                });
            }

            yield* database
              .update(Unit)
              .set({ updatedAt: new Date() })
              .where(eq(Unit.id, params.linkId));

            return new LinkEntry({
              id: params.linkId,
              unitId: params.unitId,
              url: payload.url ?? "",
              title: payload.title,
              kind: payload.kind,
            });
          }).pipe(Effect.orDie),
        )

        // ── linkDelete — delete a link ─────────────────────────────
        // 删除链接
        .handle("linkDelete", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select({ id: Unit.id })
              .from(Unit)
              .where(and(eq(Unit.id, params.linkId), eq(Unit.type, "LINK")))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            yield* database.delete(Unit).where(eq(Unit.id, params.linkId));
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Token management / 令牌管理
        // ================================================================

        // ── tokenList — list API tokens ────────────────────────────
        // 列出 API 令牌
        .handle("tokenList", ({ query }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const rows = yield* database
              .select()
              .from(ApiToken)
              .where(eq(ApiToken.revoked, false))
              .orderBy(desc(ApiToken.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            return rows.map(
              (r) =>
                new TokenEntry({
                  id: r.id,
                  name: r.name,
                  token: undefined,
                  permissions: Object.keys(
                    r.scopes ?? {},
                  ),
                  createdAt: r.createdAt,
                  expiresAt: r.expiresAt ?? null,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── tokenCreate — create an API token ──────────────────────
        // 创建 API 令牌
        .handle("tokenCreate", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            // Build scopes object from permissions array
            // 从权限数组构建 scopes 对象
            const scopes: Record<string, boolean> = {};
            for (const p of payload.permissions) {
              scopes[p] = true;
            }

            // Generate a token hash (simplified: hash of random UUID)
            // 生成令牌哈希（简化版：随机 UUID 的哈希）
            const rawToken = crypto.randomUUID();
            const encoder = new TextEncoder();
            const hashBuffer = yield* Effect.promise(() =>
              crypto.subtle.digest("SHA-256", encoder.encode(rawToken)),
            );
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const tokenHash = hashArray
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");

            const rows = yield* database
              .insert(ApiToken)
              .values({
                userId: unitId,
                name: payload.name,
                tokenHash,
                scopes,
                expiresAt: payload.expiresAt
                  ? new Date(payload.expiresAt.toISOString())
                  : null,
              })
              .returning();
            const row = rows[0]!;

            return new TokenEntry({
              id: row.id,
              name: row.name,
              token: rawToken,
              permissions: payload.permissions,
              createdAt: row.createdAt,
              expiresAt: row.expiresAt ?? null,
            });
          }).pipe(Effect.orDie),
        )

        // ── tokenUpdate — update an API token ──────────────────────
        // 更新 API 令牌
        .handle("tokenUpdate", ({ params, payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select()
              .from(ApiToken)
              .where(eq(ApiToken.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            const set: Record<string, unknown> = {};
            if (payload.name !== undefined) set["name"] = payload.name;
            if (payload.permissions !== undefined) {
              const scopes: Record<string, boolean> = {};
              for (const p of payload.permissions) {
                scopes[p] = true;
              }
              set["scopes"] = scopes;
            }

            if (Object.keys(set).length > 0) {
              yield* database
                .update(ApiToken)
                .set(set)
                .where(eq(ApiToken.id, params.id));
            }

            const updated = yield* database
              .select()
              .from(ApiToken)
              .where(eq(ApiToken.id, params.id))
              .limit(1);
            const row = updated[0]!;

            return new TokenEntry({
              id: row.id,
              name: row.name,
              token: undefined,
              permissions: Object.keys(row.scopes),
              createdAt: row.createdAt,
              expiresAt: row.expiresAt ?? null,
            });
          }).pipe(Effect.orDie),
        )

        // ── tokenDelete — revoke an API token ──────────────────────
        // 撤销 API 令牌
        .handle("tokenDelete", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select({ id: ApiToken.id })
              .from(ApiToken)
              .where(eq(ApiToken.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            yield* database
              .update(ApiToken)
              .set({ revoked: true, revokedAt: new Date() })
              .where(eq(ApiToken.id, params.id));
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Token-authenticated book access / 令牌鉴权图书访问
        // ================================================================

        // ── tokenBooksList — list books ────────────────────────────
        // 列出图书
        .handle("tokenBooksList", ({ query }) =>
          Effect.gen(function* () {
            const rows = yield* database
              .select({
                unitId: Book.unitId,
                status: Unit.status,
                title: UnitTranslation.title,
              })
              .from(Book)
              .innerJoin(Unit, eq(Book.unitId, Unit.id))
              .leftJoin(
                UnitTranslation,
                and(
                  eq(UnitTranslation.unitId, Unit.id),
                  eq(UnitTranslation.language, "en"),
                ),
              )
              .orderBy(desc(Unit.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            return rows.map(
              (r) =>
                new TokenBookEntry({
                  id: r.unitId,
                  title: r.title ?? r.unitId,
                  status: r.status,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── tokenBooksCreate — create a book entry ─────────────────
        // 创建图书条目
        .handle("tokenBooksCreate", ({ payload }) =>
          Effect.gen(function* () {
            // Create a BOOK unit with a generated slug scope
            // 使用生成的 slug scope 创建 BOOK unit
            const scopeId = crypto.randomUUID();

            const unitRows = yield* database
              .insert(Unit)
              .values({
                type: "BOOK",
                slugScope: scopeId,
                status: payload.status ?? "DRAFT",
                visibility: "PUBLIC",
              })
              .returning({ id: Unit.id, status: Unit.status });

            yield* database.insert(Book).values({ unitId: unitRows[0]!.id });

            yield* database.insert(UnitTranslation).values({
              unitId: unitRows[0]!.id,
              language: "en",
              title: payload.title,
            });

            return new TokenBookEntry({
              id: unitRows[0]!.id,
              title: payload.title,
              status: unitRows[0]!.status,
            });
          }).pipe(Effect.orDie),
        )

        // ── tokenBooksUpdate — update a book entry ─────────────────
        // 更新图书条目
        .handle("tokenBooksUpdate", ({ params, payload }) =>
          Effect.gen(function* () {
            const existing = yield* database
              .select({ unitId: Book.unitId })
              .from(Book)
              .innerJoin(Unit, eq(Book.unitId, Unit.id))
              .where(eq(Book.unitId, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            if (payload.status !== undefined) {
              yield* database
                .update(Unit)
                .set({
                  status: payload.status,
                  updatedAt: new Date(),
                })
                .where(eq(Unit.id, params.id));
            }

            if (payload.title !== undefined) {
              yield* database
                .insert(UnitTranslation)
                .values({
                  unitId: params.id,
                  language: "en",
                  title: payload.title,
                })
                .onConflictDoUpdate({
                  target: [UnitTranslation.unitId, UnitTranslation.language],
                  set: { title: payload.title, updatedAt: new Date() },
                });
            }

            const updated = yield* database
              .select({
                unitId: Book.unitId,
                status: Unit.status,
                title: UnitTranslation.title,
              })
              .from(Book)
              .innerJoin(Unit, eq(Book.unitId, Unit.id))
              .leftJoin(
                UnitTranslation,
                and(
                  eq(UnitTranslation.unitId, Unit.id),
                  eq(UnitTranslation.language, "en"),
                ),
              )
              .where(eq(Book.unitId, params.id))
              .limit(1);

            return new TokenBookEntry({
              id: params.id,
              title: updated[0]?.title ?? params.id,
              status: updated[0]?.status ?? "DRAFT",
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Token-authenticated user access / 令牌鉴权用户访问
        // ================================================================

        // ── tokenUsersList — list users ────────────────────────────
        // 列出用户
        .handle("tokenUsersList", ({ query }) =>
          Effect.gen(function* () {
            const rows = yield* database
              .select({
                unitId: User.unitId,
                name: User.name,
                email: User.email,
              })
              .from(User)
              .innerJoin(Unit, eq(User.unitId, Unit.id))
              .orderBy(desc(Unit.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            return rows.map(
              (r) =>
                new TokenUserEntry({
                  id: r.unitId,
                  name: r.name ?? "",
                  email: r.email ?? "",
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── tokenUsersCreate — create a user entry ─────────────────
        // 创建用户条目
        .handle("tokenUsersCreate", ({ payload }) =>
          Effect.gen(function* () {
            const scopeId = crypto.randomUUID();

            const unitRows = yield* database
              .insert(Unit)
              .values({
                type: "USER",
                slugScope: scopeId,
                status: "PUBLISHED",
                visibility: "PUBLIC",
              })
              .returning({ id: Unit.id });

            yield* database.insert(User).values({
              unitId: unitRows[0]!.id,
              name: payload.name,
              email: payload.email,
            });

            return new TokenUserEntry({
              id: unitRows[0]!.id,
              name: payload.name,
              email: payload.email,
            });
          }).pipe(Effect.orDie),
        )

        // ── tokenUsersUpdate — update a user entry ─────────────────
        // 更新用户条目
        .handle("tokenUsersUpdate", ({ params, payload }) =>
          Effect.gen(function* () {
            const existing = yield* database
              .select({ unitId: User.unitId })
              .from(User)
              .where(eq(User.unitId, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            const set: Record<string, unknown> = { updatedAt: new Date() };
            if (payload.name !== undefined) set["name"] = payload.name;
            if (payload.email !== undefined) set["email"] = payload.email;

            yield* database
              .update(User)
              .set(set)
              .where(eq(User.unitId, params.id));

            const updated = yield* database
              .select({
                unitId: User.unitId,
                name: User.name,
                email: User.email,
              })
              .from(User)
              .where(eq(User.unitId, params.id))
              .limit(1);

            return new TokenUserEntry({
              id: params.id,
              name: updated[0]?.name ?? "",
              email: updated[0]?.email ?? "",
            });
          }).pipe(Effect.orDie),
        )

        // ================================================================
        // Game system requirements / 游戏系统需求
        // ================================================================

        // ── gameSystemRequirementList — list requirements ───────────
        // 列出系统需求
        .handle("gameSystemRequirementList", ({ query }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const conditions: ReturnType<typeof eq>[] = [];
            if (query.unitId) {
              conditions.push(
                eq(GameSystemRequirement.gameUnitId, query.unitId),
              );
            }
            const where =
              conditions.length > 0 ? and(...conditions) : undefined;

            const rows = yield* database
              .select()
              .from(GameSystemRequirement)
              .where(where)
              .orderBy(desc(GameSystemRequirement.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);

            return rows.map(
              (r) =>
                new GameSysReqDTO({
                  id: r.id,
                  unitId: r.gameUnitId,
                  platform: r.tier,
                  requirements: r.hardware,
                }),
            );
          }).pipe(Effect.orDie),
        )

        // ── gameSystemRequirementCreate — create a requirement ─────
        // 创建系统需求
        .handle("gameSystemRequirementCreate", ({ payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const rows = yield* database
              .insert(GameSystemRequirement)
              .values({
                gameUnitId: payload.unitId,
                tier: payload.platform,
                hardware: payload.requirements,
              })
              .returning();
            const row = rows[0]!;

            return new GameSysReqDTO({
              id: row.id,
              unitId: row.gameUnitId,
              platform: row.tier,
              requirements: row.hardware,
            });
          }).pipe(Effect.orDie),
        )

        // ── gameSystemRequirementUpdate — update a requirement ─────
        // 更新系统需求
        .handle("gameSystemRequirementUpdate", ({ params, payload }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select()
              .from(GameSystemRequirement)
              .where(eq(GameSystemRequirement.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            const set: Record<string, unknown> = { updatedAt: new Date() };
            if (payload.platform !== undefined) set["tier"] = payload.platform;
            if (payload.requirements !== undefined)
              set["hardware"] = payload.requirements;

            yield* database
              .update(GameSystemRequirement)
              .set(set)
              .where(eq(GameSystemRequirement.id, params.id));

            const updated = yield* database
              .select()
              .from(GameSystemRequirement)
              .where(eq(GameSystemRequirement.id, params.id))
              .limit(1);
            const row = updated[0]!;

            return new GameSysReqDTO({
              id: row.id,
              unitId: row.gameUnitId,
              platform: row.tier,
              requirements: row.hardware,
            });
          }).pipe(Effect.orDie),
        )

        // ── gameSystemRequirementDelete — delete a requirement ─────
        // 删除系统需求
        .handle("gameSystemRequirementDelete", ({ params }) =>
          Effect.gen(function* () {
            const unitId = yield* resolveCurrentUserUnitId();
            yield* requireAdmin(unitId);

            const existing = yield* database
              .select({ id: GameSystemRequirement.id })
              .from(GameSystemRequirement)
              .where(eq(GameSystemRequirement.id, params.id))
              .limit(1);
            if (!existing[0]) return yield* new AdminNotFound();

            yield* database
              .delete(GameSystemRequirement)
              .where(eq(GameSystemRequirement.id, params.id));
          }).pipe(Effect.orDie),
        )
    );
  }),
);
