import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, desc, eq, sql } from "drizzle-orm";

import { Config } from "../../config/index.ts";
import { Database } from "../../database/index.ts";
import {
  AccountEnforcement,
  Feedback,
  ModerationAction,
  ModerationCase,
  RealmCapabilityGrant,
  RealmMember,
  StaffAuditLog,
  StaffGrant,
  Unit,
  UnitRealm,
} from "../../database/schema/all.ts";
import {
  type AccountEnforcementStateStorage,
  accountEnforcementStateStorageValues,
} from "../../database/schema/governance.ts";
import {
  type ModerationCaseStateStorage,
  moderationCaseStateStorageValues,
} from "../../database/schema/moderation.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  AccountEnforcementDTO,
  ActiveEnforcementResult,
  CapabilityHintsResult,
  GovernanceForbidden,
  GovernanceNotFound,
  ModerationActionDTO,
  ModerationCaseDTO,
  PolicyDecisionResult,
  RealmCapabilityGrantDTO,
  StaffAuditLogDTO,
} from "../interfaces/governance.ts";

// ---------------------------------------------------------------------------
// Type guards — narrow the shared ListQuery.state union to domain-specific enums
// 类型守卫 — 将共享 ListQuery.state 联合类型收窄为领域专用枚举
// ---------------------------------------------------------------------------

function isAccountEnforcementState(s: string): s is AccountEnforcementStateStorage {
  return (accountEnforcementStateStorageValues as readonly string[]).includes(s);
}

function isModerationCaseState(s: string): s is ModerationCaseStateStorage {
  return (moderationCaseStateStorageValues as readonly string[]).includes(s);
}

// ---------------------------------------------------------------------------
// Handlers — governance domain
// 处理器 — 治理领域
// ---------------------------------------------------------------------------

export const GovernanceHandlers = HttpApiBuilder.group(
  Api,
  "governance",
  Effect.fn(function* (handlers) {
    const database = yield* Database;
    const { pagination } = yield* Config;
    const lim = (n?: number) => Math.min(n ?? pagination.defaultLimit, pagination.maxLimit);

    // ── Shared helpers (close over database) ──────────────────────────────
    // 共享辅助函数（闭包引用 database）

    /**
     * Require the caller has at least one active StaffGrant capability.
     * 要求调用者拥有至少一个活跃的 StaffGrant 能力。
     */
    const requireStaff = (userId: string) =>
      Effect.gen(function* () {
        const grants = yield*
          database
            .select()
            .from(StaffGrant)
            .where(and(eq(StaffGrant.userId, userId), eq(StaffGrant.state, "ACTIVE")))
            .limit(1);
        if (!grants[0]) return yield* new GovernanceForbidden();
        return grants;
      });

    /**
     * Require the caller is an owner/moderator of the realm, or has a staff grant.
     * 要求调用者是 realm 的 owner/moderator，或拥有 staff 权限。
     */
    const requireRealmMod = (realmUnitId: string, userId: string) =>
      Effect.gen(function* () {
        const membership = yield*
          database
            .select()
            .from(RealmMember)
            .where(
              and(
                eq(RealmMember.realmUnitId, realmUnitId),
                eq(RealmMember.userId, userId),
                eq(RealmMember.state, "ACTIVE"),
              ),
            )
            .limit(1);
        if (membership[0] && (membership[0].roleKey === "owner" || membership[0].roleKey === "moderator")) {
          return membership[0];
        }
        // Fall back to staff grant check
        // 回退到 staff 权限检查
        const staffGrants = yield*
          database
            .select()
            .from(StaffGrant)
            .where(and(eq(StaffGrant.userId, userId), eq(StaffGrant.state, "ACTIVE")))
            .limit(1);
        if (!staffGrants[0]) return yield* new GovernanceForbidden();
        return membership[0] ?? null;
      });

    /**
     * Insert a ModerationAction audit row and return its id.
     * 插入一条 ModerationAction 审计行并返回其 id。
     */
    const insertAction = (values: typeof ModerationAction.$inferInsert) =>
      Effect.gen(function* () {
        const rows = yield*
          database.insert(ModerationAction).values(values).returning();
        return rows[0]!;
      });

    /**
     * Insert a StaffAuditLog entry.
     * 插入 StaffAuditLog 条目。
     */
    const insertAudit = (values: typeof StaffAuditLog.$inferInsert) =>
      Effect.gen(function* () {
        const rows = yield*
          database.insert(StaffAuditLog).values(values).returning();
        return rows[0]!;
      });

    // -- DTO mapping helpers -- raw Drizzle rows → typed Schema.Class DTOs --
    // DTO 映射辅助函数 — 原始 Drizzle 行 → 类型化 Schema.Class DTO

    const toRealmCapabilityGrantDTO = (r: typeof RealmCapabilityGrant.$inferSelect) =>
      new RealmCapabilityGrantDTO({
        id: r.id,
        realmUnitId: r.realmUnitId,
        userId: r.userId,
        capability: r.capability,
        state: r.state,
        grantedById: r.grantedById,
        revokedById: r.revokedById,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        revokedAt: r.revokedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });

    const toModerationActionDTO = (r: typeof ModerationAction.$inferSelect) =>
      new ModerationActionDTO({
        id: r.id,
        authority: r.authority,
        realmUnitId: r.realmUnitId,
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetPath: r.targetPath,
        actorKind: r.actorKind,
        actorUserId: r.actorUserId,
        actionKind: r.actionKind,
        resultingStatus: r.resultingStatus,
        resultingLocked: r.resultingLocked,
        reasonCode: r.reasonCode,
        reasonText: r.reasonText,
        publicMessage: r.publicMessage,
        caseId: r.caseId,
        reversesActionId: r.reversesActionId,
        requestId: r.requestId,
        idempotencyKey: r.idempotencyKey,
        importedFrom: r.importedFrom,
        createdAt: r.createdAt.toISOString(),
      });

    const toAccountEnforcementDTO = (r: typeof AccountEnforcement.$inferSelect) =>
      new AccountEnforcementDTO({
        id: r.id,
        targetUserId: r.targetUserId,
        kind: r.kind,
        state: r.state,
        reason: r.reason,
        safeMessage: r.safeMessage,
        decidedById: r.decidedById,
        decisionCode: r.decisionCode,
        startsAt: r.startsAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
        revokedAt: r.revokedAt?.toISOString() ?? null,
        revokedById: r.revokedById,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        decisionActionId: r.decisionActionId,
        revocationActionId: r.revocationActionId,
      });

    const toModerationCaseDTO = (r: typeof ModerationCase.$inferSelect) =>
      new ModerationCaseDTO({
        id: r.id,
        state: r.state,
        severity: r.severity,
        reporterUserId: r.reporterUserId,
        subjectUserId: r.subjectUserId,
        targetKind: r.targetKind,
        targetId: r.targetId,
        addressedUnitId: r.addressedUnitId,
        realmUnitId: r.realmUnitId,
        sourceFeedbackId: r.sourceFeedbackId,
        assignedToUserId: r.assignedToUserId,
        duplicateOfCaseId: r.duplicateOfCaseId,
        reason: r.reason,
        safeSummary: r.safeSummary,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        parentCaseId: r.parentCaseId,
        scope: r.scope,
      });

    const toStaffAuditLogDTO = (r: typeof StaffAuditLog.$inferSelect) =>
      new StaffAuditLogDTO({
        id: r.id,
        actorUserId: r.actorUserId,
        action: r.action,
        targetKind: r.targetKind,
        targetId: r.targetId,
        decisionCode: r.decisionCode,
        requestId: r.requestId,
        reason: r.reason,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      });

    return handlers
      // ── capabilityHintsMe — resolve current user capability hints ──
      // 解析当前用户的能力提示
      .handle("capabilityHintsMe", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const staffRows = yield*
            database
              .select()
              .from(StaffGrant)
              .where(and(eq(StaffGrant.userId, user.id), eq(StaffGrant.state, "ACTIVE")));
          const realmRows = yield*
            database
              .select()
              .from(RealmCapabilityGrant)
              .where(
                and(eq(RealmCapabilityGrant.userId, user.id), eq(RealmCapabilityGrant.state, "ACTIVE")),
              );
          const capabilities = [
            ...staffRows.map((r) => ({
              kind: "staff" as const,
              capability: r.capability,
              scopeKind: r.scopeKind,
              realmUnitId: r.realmUnitId,
            })),
            ...realmRows.map((r) => ({
              kind: "realm" as const,
              capability: r.capability,
              realmUnitId: r.realmUnitId,
            })),
          ];
          return new CapabilityHintsResult({ capabilities });
        }).pipe(Effect.orDie),
      )

      // ── grantRealmCapability — grant realm capability to member ────
      // 授予 Realm 成员能力
      .handle("grantRealmCapability", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const rows = yield*
            database
              .insert(RealmCapabilityGrant)
              .values({
                realmUnitId: params.realmUnitId,
                userId: params.userId,
                capability: payload.capability,
                grantedById: user.id,
                state: "ACTIVE",
              })
              .returning();
          yield* insertAudit({
            actorUserId: user.id,
            action: "GRANT_REALM_CAPABILITY",
            targetKind: "REALM_MEMBER",
            targetId: `${params.realmUnitId}:${params.userId}`,
            decisionCode: "GRANTED",
            reason: payload.reason ?? "Capability granted",
          });
          return toRealmCapabilityGrantDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── revokeRealmCapability — revoke realm capability from member ──
      // 撤销 Realm 成员能力
      .handle("revokeRealmCapability", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const now = new Date();
          const rows = yield*
            database
              .update(RealmCapabilityGrant)
              .set({ state: "REVOKED", revokedById: user.id, revokedAt: now, updatedAt: now })
              .where(
                and(
                  eq(RealmCapabilityGrant.realmUnitId, params.realmUnitId),
                  eq(RealmCapabilityGrant.userId, params.userId),
                  eq(RealmCapabilityGrant.capability, params.capability),
                  eq(RealmCapabilityGrant.state, "ACTIVE"),
                ),
              )
              .returning();
          yield* insertAudit({
            actorUserId: user.id,
            action: "REVOKE_REALM_CAPABILITY",
            targetKind: "REALM_MEMBER",
            targetId: `${params.realmUnitId}:${params.userId}`,
            decisionCode: "REVOKED",
            reason: `Revoked capability ${params.capability}`,
          });
          return rows.map(toRealmCapabilityGrantDTO);
        }).pipe(Effect.orDie),
      )

      // ── policyDecide — evaluate governance policy decision ─────────
      // 评估治理策略决策
      .handle("policyDecide", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          // Policy evaluation: check staff grants for the requested action
          // 策略评估：检查请求动作对应的 staff 权限
          const action = payload.action ?? "unknown";
          const grants = yield*
            database
              .select()
              .from(StaffGrant)
              .where(and(eq(StaffGrant.userId, user.id), eq(StaffGrant.state, "ACTIVE")));
          const hasCapability = grants.some(
            (g) => g.capability === action || g.capability === "*",
          );
          return new PolicyDecisionResult({
            allowed: hasCapability,
            actor: user.id,
            action,
            grants: grants.map((g) => g.capability),
          });
        }).pipe(Effect.orDie),
      )

      // ── listModerationActions — list moderation actions for a target ──
      // 列出目标的审核动作
      .handle("listModerationActions", ({ params, query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const targetKind = params.targetKind;
          const rows = yield*
            database
              .select()
              .from(ModerationAction)
              .where(
                and(
                  eq(ModerationAction.targetKind, targetKind),
                  eq(ModerationAction.targetId, params.targetId),
                ),
              )
              .orderBy(desc(ModerationAction.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(toModerationActionDTO);
        }).pipe(Effect.orDie),
      )

      // ── listModerationOverlays — batch-read moderation overlays ───
      // 批量读取审核叠加层
      .handle("listModerationOverlays", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const unitIds = payload.unitIds;
          if (unitIds.length === 0) return [];
          // Return the latest ModerationAction per unit (target) for overlay state
          // 返回每个 unit（目标）的最新 ModerationAction 作为叠加层状态
          const rows = yield*
            database
              .select()
              .from(ModerationAction)
              .where(
                and(
                  eq(ModerationAction.targetKind, "UNIT"),
                  sql`${ModerationAction.targetId} = ANY(${unitIds})`,
                ),
              )
              .orderBy(desc(ModerationAction.createdAt))
              .limit(unitIds.length * 5);
          // Deduplicate: keep latest action per targetId
          // 去重：每个 targetId 保留最新动作
          const seen = new Set<string>();
          const deduped: typeof rows = [];
          for (const row of rows) {
            if (!seen.has(row.targetId)) {
              seen.add(row.targetId);
              deduped.push(row);
            }
          }
          return deduped.map(toModerationActionDTO);
        }).pipe(Effect.orDie),
      )

      // ── contentApprove — global content approval ──────────────────
      // 全局内容批准
      .handle("contentApprove", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          yield*
            database
              .update(Unit)
              .set({ moderationStatus: "APPROVED" })
              .where(eq(Unit.id, params.targetUnitId));
          const action = yield* insertAction({
            authority: "PLATFORM",
            targetKind: "UNIT",
            targetId: params.targetUnitId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "APPROVE",
            resultingStatus: "APPROVED",
            reasonCode: "CONTENT_APPROVED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          yield* insertAudit({
            actorUserId: user.id,
            action: "CONTENT_APPROVE",
            targetKind: "UNIT",
            targetId: params.targetUnitId,
            decisionCode: "APPROVED",
            reason: payload.reason ?? "Content approved",
          });
          return [toModerationActionDTO(action)];
        }).pipe(Effect.orDie),
      )

      // ── contentRemove — global content removal ────────────────────
      // 全局内容移除
      .handle("contentRemove", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          yield*
            database
              .update(Unit)
              .set({ moderationStatus: "REMOVED" })
              .where(eq(Unit.id, params.targetUnitId));
          const action = yield* insertAction({
            authority: "PLATFORM",
            targetKind: "UNIT",
            targetId: params.targetUnitId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "REMOVE",
            resultingStatus: "REMOVED",
            reasonCode: "CONTENT_REMOVED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          yield* insertAudit({
            actorUserId: user.id,
            action: "CONTENT_REMOVE",
            targetKind: "UNIT",
            targetId: params.targetUnitId,
            decisionCode: "REMOVED",
            reason: payload.reason ?? "Content removed",
          });
          return [toModerationActionDTO(action)];
        }).pipe(Effect.orDie),
      )

      // ── contentRestore — global content restoration ───────────────
      // 全局内容恢复
      .handle("contentRestore", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          yield*
            database
              .update(Unit)
              .set({ moderationStatus: "APPROVED" })
              .where(eq(Unit.id, params.targetUnitId));
          const action = yield* insertAction({
            authority: "PLATFORM",
            targetKind: "UNIT",
            targetId: params.targetUnitId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "RESTORE",
            resultingStatus: "APPROVED",
            reasonCode: "CONTENT_RESTORED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          yield* insertAudit({
            actorUserId: user.id,
            action: "CONTENT_RESTORE",
            targetKind: "UNIT",
            targetId: params.targetUnitId,
            decisionCode: "RESTORED",
            reason: payload.reason ?? "Content restored",
          });
          return [toModerationActionDTO(action)];
        }).pipe(Effect.orDie),
      )

      // ── realmContentApprove — realm-scoped content approval ───────
      // Realm 范围内容批准
      .handle("realmContentApprove", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          yield*
            database
              .update(UnitRealm)
              .set({ moderationStatus: "APPROVED" })
              .where(
                and(
                  eq(UnitRealm.realmUnitId, params.realmUnitId),
                  eq(UnitRealm.unitId, params.targetUnitId),
                ),
              );
          const action = yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: "UNIT_REALM",
            targetId: `${params.realmUnitId}:${params.targetUnitId}`,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "APPROVE",
            resultingStatus: "APPROVED",
            reasonCode: "REALM_CONTENT_APPROVED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          return toModerationActionDTO(action);
        }).pipe(Effect.orDie),
      )

      // ── realmContentRemove — realm-scoped content removal ─────────
      // Realm 范围内容移除
      .handle("realmContentRemove", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          yield*
            database
              .update(UnitRealm)
              .set({ moderationStatus: "REMOVED" })
              .where(
                and(
                  eq(UnitRealm.realmUnitId, params.realmUnitId),
                  eq(UnitRealm.unitId, params.targetUnitId),
                ),
              );
          const action = yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: "UNIT_REALM",
            targetId: `${params.realmUnitId}:${params.targetUnitId}`,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "REMOVE",
            resultingStatus: "REMOVED",
            reasonCode: "REALM_CONTENT_REMOVED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          return toModerationActionDTO(action);
        }).pipe(Effect.orDie),
      )

      // ── realmContentRestore — realm-scoped content restoration ────
      // Realm 范围内容恢复
      .handle("realmContentRestore", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          yield*
            database
              .update(UnitRealm)
              .set({ moderationStatus: "APPROVED" })
              .where(
                and(
                  eq(UnitRealm.realmUnitId, params.realmUnitId),
                  eq(UnitRealm.unitId, params.targetUnitId),
                ),
              );
          const action = yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: "UNIT_REALM",
            targetId: `${params.realmUnitId}:${params.targetUnitId}`,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "RESTORE",
            resultingStatus: "APPROVED",
            reasonCode: "REALM_CONTENT_RESTORED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          return toModerationActionDTO(action);
        }).pipe(Effect.orDie),
      )

      // ── realmContentLock — realm-scoped content lock ──────────────
      // Realm 范围内容锁定
      .handle("realmContentLock", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          yield*
            database
              .update(UnitRealm)
              .set({ isLocked: true })
              .where(
                and(
                  eq(UnitRealm.realmUnitId, params.realmUnitId),
                  eq(UnitRealm.unitId, params.targetUnitId),
                ),
              );
          const action = yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: "UNIT_REALM",
            targetId: `${params.realmUnitId}:${params.targetUnitId}`,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "LOCK",
            resultingLocked: true,
            reasonCode: "REALM_CONTENT_LOCKED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          return toModerationActionDTO(action);
        }).pipe(Effect.orDie),
      )

      // ── realmContentUnlock — realm-scoped content unlock ──────────
      // Realm 范围内容解锁
      .handle("realmContentUnlock", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          yield*
            database
              .update(UnitRealm)
              .set({ isLocked: false })
              .where(
                and(
                  eq(UnitRealm.realmUnitId, params.realmUnitId),
                  eq(UnitRealm.unitId, params.targetUnitId),
                ),
              );
          const action = yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: "UNIT_REALM",
            targetId: `${params.realmUnitId}:${params.targetUnitId}`,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "UNLOCK",
            resultingLocked: false,
            reasonCode: "REALM_CONTENT_UNLOCKED",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          return toModerationActionDTO(action);
        }).pipe(Effect.orDie),
      )

      // ── realmContentOwnerDelegation — realm content owner delegation ──
      // Realm 内容所有者委托
      .handle("realmContentOwnerDelegation", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const action = yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: "UNIT_REALM",
            targetId: `${params.realmUnitId}:${params.targetUnitId}`,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "NOTE",
            reasonCode: "OWNER_DELEGATION",
            reasonText: payload.reason ?? null,
            caseId: payload.caseId ?? null,
          });
          yield* insertAudit({
            actorUserId: user.id,
            action: "REALM_OWNER_DELEGATION",
            targetKind: "UNIT_REALM",
            targetId: `${params.realmUnitId}:${params.targetUnitId}`,
            decisionCode: "DELEGATED",
            reason: payload.reason ?? "Owner delegation recorded",
          });
          return toModerationActionDTO(action);
        }).pipe(Effect.orDie),
      )

      // ── getActiveEnforcement — active enforcement summary ─────────
      // 获取活跃执行措施摘要
      .handle("getActiveEnforcement", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const rows = yield*
            database
              .select()
              .from(AccountEnforcement)
              .where(
                and(
                  eq(AccountEnforcement.targetUserId, params.targetUserId),
                  eq(AccountEnforcement.state, "ACTIVE"),
                ),
              )
              .orderBy(desc(AccountEnforcement.createdAt));
          return new ActiveEnforcementResult({
            targetUserId: params.targetUserId,
            active: rows.map(toAccountEnforcementDTO),
            count: rows.length,
          });
        }).pipe(Effect.orDie),
      )

      // ── listEnforcements — list enforcement records ───────────────
      // 列出执行措施记录
      .handle("listEnforcements", ({ params, query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const conditions: ReturnType<typeof eq>[] = [eq(AccountEnforcement.targetUserId, params.targetUserId)];
          if (query.state && isAccountEnforcementState(query.state)) {
            conditions.push(
              eq(AccountEnforcement.state, query.state),
            );
          }
          const rows = yield*
            database
              .select()
              .from(AccountEnforcement)
              .where(and(...conditions))
              .orderBy(desc(AccountEnforcement.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(toAccountEnforcementDTO);
        }).pipe(Effect.orDie),
      )

      // ── applyEnforcement — apply enforcement to user ──────────────
      // 应用执行措施
      .handle("applyEnforcement", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const kind = payload.kind ?? "WARNING";
          const reason = payload.reason ?? "Enforcement applied";
          const decisionCode = payload.decisionCode ?? "ENFORCED";
          const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
          const enforcementKind = kind;
          const actionKind = kind;
          // Insert moderation action first for reference
          // 先插入审核动作以供引用
          const action = yield* insertAction({
            authority: "PLATFORM",
            targetKind: "ACCOUNT",
            targetId: params.targetUserId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind,
            reasonCode: decisionCode,
            reasonText: reason,
            caseId: payload.caseId ?? null,
          });
          const rows = yield*
            database
              .insert(AccountEnforcement)
              .values({
                targetUserId: params.targetUserId,
                kind: enforcementKind,
                state: "ACTIVE",
                reason,
                safeMessage: payload.safeMessage ?? null,
                decidedById: user.id,
                decisionCode,
                expiresAt,
                decisionActionId: action.id,
                metadata: payload.metadata ?? null,
              })
              .returning();
          yield* insertAudit({
            actorUserId: user.id,
            action: `ENFORCEMENT_${kind}`,
            targetKind: "ACCOUNT",
            targetId: params.targetUserId,
            decisionCode,
            reason,
          });
          return toAccountEnforcementDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── unblockEnforcement — revoke active enforcements ───────────
      // 解除账户封禁
      .handle("unblockEnforcement", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const reason = payload.reason ?? "Enforcement revoked";
          const now = new Date();
          // Insert a reversal moderation action
          // 插入一条撤销审核动作
          const action = yield* insertAction({
            authority: "PLATFORM",
            targetKind: "ACCOUNT",
            targetId: params.targetUserId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "REVOKE_ENFORCEMENT",
            reasonCode: "UNBLOCKED",
            reasonText: reason,
          });
          const rows = yield*
            database
              .update(AccountEnforcement)
              .set({
                state: "REVOKED",
                revokedAt: now,
                revokedById: user.id,
                revocationActionId: action.id,
                updatedAt: now,
              })
              .where(
                and(
                  eq(AccountEnforcement.targetUserId, params.targetUserId),
                  eq(AccountEnforcement.state, "ACTIVE"),
                ),
              )
              .returning();
          yield* insertAudit({
            actorUserId: user.id,
            action: "ENFORCEMENT_REVOKE",
            targetKind: "ACCOUNT",
            targetId: params.targetUserId,
            decisionCode: "UNBLOCKED",
            reason,
          });
          return rows.map(toAccountEnforcementDTO);
        }).pipe(Effect.orDie),
      )

      // ── listCases — list global moderation cases ──────────────────
      // 列出全局审核案例
      .handle("listCases", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const conditions: ReturnType<typeof eq>[] = [eq(ModerationCase.scope, "PLATFORM")];
          if (query.state && isModerationCaseState(query.state)) {
            conditions.push(
              eq(ModerationCase.state, query.state),
            );
          }
          const rows = yield*
            database
              .select()
              .from(ModerationCase)
              .where(and(...conditions))
              .orderBy(desc(ModerationCase.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(toModerationCaseDTO);
        }).pipe(Effect.orDie),
      )

      // ── getCase — fetch single case ───────────────────────────────
      // 获取单条案例
      .handle("getCase", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const rows = yield*
            database.select().from(ModerationCase).where(eq(ModerationCase.id, params.caseId)).limit(1);
          if (!rows[0]) return yield* new GovernanceForbidden();
          return toModerationCaseDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── listCaseActions — list moderation actions linked to a case ──
      // 列出链接到案例的审核动作
      .handle("listCaseActions", ({ params, query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const rows = yield*
            database
              .select()
              .from(ModerationAction)
              .where(eq(ModerationAction.caseId, params.caseId))
              .orderBy(desc(ModerationAction.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(toModerationActionDTO);
        }).pipe(Effect.orDie),
      )

      // ── createCaseFromFeedback — create case from feedback report ──
      // 从反馈报告创建案例
      .handle("createCaseFromFeedback", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const feedbackRows = yield*
            database.select().from(Feedback).where(eq(Feedback.id, params.feedbackId)).limit(1);
          if (!feedbackRows[0]) return yield* new GovernanceForbidden();
          const fb = feedbackRows[0];
          const rows = yield*
            database
              .insert(ModerationCase)
              .values({
                scope: "PLATFORM",
                state: "NEW",
                reporterUserId: fb.userId,
                targetKind: fb.targetKind ?? "UNIT",
                targetId: fb.targetId ?? fb.addressedUnitId ?? params.feedbackId,
                addressedUnitId: fb.addressedUnitId ?? null,
                sourceFeedbackId: fb.id,
                reason: payload.reason ?? fb.content,
                severity: payload.severity ?? null,
              })
              .returning();
          yield* insertAudit({
            actorUserId: user.id,
            action: "CASE_CREATE_FROM_FEEDBACK",
            targetKind: "FEEDBACK",
            targetId: params.feedbackId,
            decisionCode: "CREATED",
            reason: payload.reason ?? "Case created from feedback",
          });
          return toModerationCaseDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── duplicateCase — mark case as duplicate of another ─────────
      // 标记案例为另一案例的副本
      .handle("duplicateCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const duplicateOfCaseId = payload.duplicateOfCaseId;
          const now = new Date();
          const rows = yield*
            database
              .update(ModerationCase)
              .set({ state: "DUPLICATE", duplicateOfCaseId, updatedAt: now })
              .where(eq(ModerationCase.id, params.caseId))
              .returning();
          if (!rows[0]) return yield* new GovernanceForbidden();
          yield* insertAudit({
            actorUserId: user.id,
            action: "CASE_DUPLICATE",
            targetKind: "CASE",
            targetId: params.caseId,
            decisionCode: "DUPLICATE",
            reason: `Marked as duplicate of ${duplicateOfCaseId}`,
          });
          return toModerationCaseDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── assignCase — assign case to a user ────────────────────────
      // 将案例分配给用户
      .handle("assignCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const assignedToUserId = payload.assignedToUserId ?? user.id;
          const now = new Date();
          const rows = yield*
            database
              .update(ModerationCase)
              .set({ state: "ASSIGNED", assignedToUserId, updatedAt: now })
              .where(eq(ModerationCase.id, params.caseId))
              .returning();
          if (!rows[0]) return yield* new GovernanceForbidden();
          yield* insertAudit({
            actorUserId: user.id,
            action: "CASE_ASSIGN",
            targetKind: "CASE",
            targetId: params.caseId,
            decisionCode: "ASSIGNED",
            reason: `Assigned to ${assignedToUserId}`,
          });
          return toModerationCaseDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── triageCase — triage case (set severity + state) ───────────
      // 对案例进行分类（设置严重性 + 状态）
      .handle("triageCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const now = new Date();
          const rows = yield*
            database
              .update(ModerationCase)
              .set({
                state: "TRIAGED",
                severity: payload.severity ?? null,
                updatedAt: now,
              })
              .where(eq(ModerationCase.id, params.caseId))
              .returning();
          if (!rows[0]) return yield* new GovernanceForbidden();
          yield* insertAudit({
            actorUserId: user.id,
            action: "CASE_TRIAGE",
            targetKind: "CASE",
            targetId: params.caseId,
            decisionCode: "TRIAGED",
            reason: payload.reason ?? "Case triaged",
          });
          return toModerationCaseDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── decideCase — record a decision on a case ──────────────────
      // 对案例记录决策
      .handle("decideCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const decisionCode = payload.decisionCode ?? "ACTIONED";
          const now = new Date();
          const rows = yield*
            database
              .update(ModerationCase)
              .set({ state: "ACTIONED", updatedAt: now })
              .where(eq(ModerationCase.id, params.caseId))
              .returning();
          if (!rows[0]) return yield* new GovernanceForbidden();
          yield* insertAction({
            authority: "PLATFORM",
            targetKind: rows[0].targetKind,
            targetId: rows[0].targetId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: payload.actionKind ?? "NOTE",
            reasonCode: decisionCode,
            reasonText: payload.reason ?? null,
            caseId: params.caseId,
          });
          yield* insertAudit({
            actorUserId: user.id,
            action: "CASE_DECIDE",
            targetKind: "CASE",
            targetId: params.caseId,
            decisionCode,
            reason: payload.reason ?? "Decision recorded",
          });
          return toModerationCaseDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── appealCase — register an appeal on a case ─────────────────
      // 对案例提交申诉
      .handle("appealCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const now = new Date();
          // Check the case exists
          // 检查案例是否存在
          const caseRows = yield*
            database.select().from(ModerationCase).where(eq(ModerationCase.id, params.caseId)).limit(1);
          if (!caseRows[0]) return yield* new GovernanceForbidden();
          // Create a child case for the appeal
          // 为申诉创建子案例
          const rows = yield*
            database
              .insert(ModerationCase)
              .values({
                scope: caseRows[0].scope,
                state: "NEW",
                reporterUserId: user.id,
                targetKind: caseRows[0].targetKind,
                targetId: caseRows[0].targetId,
                addressedUnitId: caseRows[0].addressedUnitId,
                realmUnitId: caseRows[0].realmUnitId,
                parentCaseId: params.caseId,
                reason: payload.reason ?? "Appeal submitted",
                severity: payload.severity ?? null,
              })
              .returning();
          // Update the parent case state to REVIEWING if it was ACTIONED/RESOLVED
          // 如果父案例状态为 ACTIONED/RESOLVED，则更新为 REVIEWING
          yield*
            database
              .update(ModerationCase)
              .set({ state: "REVIEWING", updatedAt: now })
              .where(eq(ModerationCase.id, params.caseId));
          yield* insertAudit({
            actorUserId: user.id,
            action: "CASE_APPEAL",
            targetKind: "CASE",
            targetId: params.caseId,
            decisionCode: "APPEALED",
            reason: payload.reason ?? "Appeal submitted",
          });
          return toModerationCaseDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── listRealmCases — list realm-scoped cases ──────────────────
      // 列出 Realm 范围案例
      .handle("listRealmCases", ({ params, query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const conditions: ReturnType<typeof eq>[] = [
            eq(ModerationCase.realmUnitId, params.realmUnitId),
          ];
          if (query.state && isModerationCaseState(query.state)) {
            conditions.push(
              eq(ModerationCase.state, query.state),
            );
          }
          const rows = yield*
            database
              .select()
              .from(ModerationCase)
              .where(and(...conditions))
              .orderBy(desc(ModerationCase.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(toModerationCaseDTO);
        }).pipe(Effect.orDie),
      )

      // ── createRealmCase — create a realm-scoped case ──────────────
      // 创建 Realm 范围案例
      .handle("createRealmCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const targetKind =
            payload.targetKind ?? "UNIT";
          const rows = yield*
            database
              .insert(ModerationCase)
              .values({
                scope: "REALM",
                state: "NEW",
                realmUnitId: params.realmUnitId,
                reporterUserId: user.id,
                targetKind,
                targetId: payload.targetId ?? "",
                addressedUnitId: payload.addressedUnitId ?? null,
                subjectUserId: payload.subjectUserId ?? null,
                reason: payload.reason ?? null,
                severity: payload.severity ?? null,
              })
              .returning();
          yield* insertAudit({
            actorUserId: user.id,
            action: "REALM_CASE_CREATE",
            targetKind: "CASE",
            targetId: rows[0]!.id,
            decisionCode: "CREATED",
            reason: payload.reason ?? "Realm case created",
          });
          return toModerationCaseDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── createRealmCaseFromFeedback — realm case from feedback ────
      // 从反馈创建 Realm 案例
      .handle("createRealmCaseFromFeedback", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const feedbackRows = yield*
            database.select().from(Feedback).where(eq(Feedback.id, params.feedbackId)).limit(1);
          if (!feedbackRows[0]) return yield* new GovernanceForbidden();
          const fb = feedbackRows[0];
          const rows = yield*
            database
              .insert(ModerationCase)
              .values({
                scope: "REALM",
                state: "NEW",
                realmUnitId: params.realmUnitId,
                reporterUserId: fb.userId,
                targetKind: fb.targetKind ?? "UNIT",
                targetId: fb.targetId ?? fb.addressedUnitId ?? params.feedbackId,
                addressedUnitId: fb.addressedUnitId ?? null,
                sourceFeedbackId: fb.id,
                reason: payload.reason ?? fb.content,
                severity: payload.severity ?? null,
              })
              .returning();
          yield* insertAudit({
            actorUserId: user.id,
            action: "REALM_CASE_CREATE_FROM_FEEDBACK",
            targetKind: "FEEDBACK",
            targetId: params.feedbackId,
            decisionCode: "CREATED",
            reason: payload.reason ?? "Realm case created from feedback",
          });
          return toModerationCaseDTO(rows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── listRealmCaseActions — list actions for a realm case ──────
      // 列出 Realm 案例的动作
      .handle("listRealmCaseActions", ({ params, query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const rows = yield*
            database
              .select()
              .from(ModerationAction)
              .where(
                and(
                  eq(ModerationAction.caseId, params.caseId),
                  eq(ModerationAction.realmUnitId, params.realmUnitId),
                ),
              )
              .orderBy(desc(ModerationAction.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(toModerationActionDTO);
        }).pipe(Effect.orDie),
      )

      // ── decideRealmCase — decide a realm-scoped case ──────────────
      // 对 Realm 案例作出决策
      .handle("decideRealmCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const decisionCode = payload.decisionCode ?? "ACTIONED";
          const now = new Date();
          const rows = yield*
            database
              .update(ModerationCase)
              .set({ state: "ACTIONED", updatedAt: now })
              .where(
                and(
                  eq(ModerationCase.id, params.caseId),
                  eq(ModerationCase.realmUnitId, params.realmUnitId),
                ),
              )
              .returning();
          if (!rows[0]) return yield* new GovernanceForbidden();
          yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: rows[0].targetKind,
            targetId: rows[0].targetId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: payload.actionKind ?? "NOTE",
            reasonCode: decisionCode,
            reasonText: payload.reason ?? null,
            caseId: params.caseId,
          });
          yield* insertAudit({
            actorUserId: user.id,
            action: "REALM_CASE_DECIDE",
            targetKind: "CASE",
            targetId: params.caseId,
            decisionCode,
            reason: payload.reason ?? "Realm case decision recorded",
          });
          return toModerationCaseDTO(rows[0]);
        }).pipe(Effect.orDie),
      )

      // ── escalateRealmCase — escalate realm case to platform level ──
      // 将 Realm 案例升级到平台级别
      .handle("escalateRealmCase", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireRealmMod(params.realmUnitId, user.id);
          const now = new Date();
          // Update realm case state to ESCALATED
          // 将 Realm 案例状态更新为 ESCALATED
          const caseRows = yield*
            database
              .update(ModerationCase)
              .set({ state: "ESCALATED", updatedAt: now })
              .where(
                and(
                  eq(ModerationCase.id, params.caseId),
                  eq(ModerationCase.realmUnitId, params.realmUnitId),
                ),
              )
              .returning();
          if (!caseRows[0]) return yield* new GovernanceForbidden();
          // Create a platform-scoped case referencing the realm case
          // 创建引用 Realm 案例的平台级案例
          const escalatedRows = yield*
            database
              .insert(ModerationCase)
              .values({
                scope: "PLATFORM",
                state: "NEW",
                realmUnitId: params.realmUnitId,
                reporterUserId: user.id,
                targetKind: caseRows[0].targetKind,
                targetId: caseRows[0].targetId,
                addressedUnitId: caseRows[0].addressedUnitId,
                subjectUserId: caseRows[0].subjectUserId,
                parentCaseId: params.caseId,
                reason: payload.reason ?? `Escalated from realm case ${params.caseId}`,
                severity: payload.severity ?? caseRows[0].severity,
              })
              .returning();
          yield* insertAction({
            authority: "REALM",
            realmUnitId: params.realmUnitId,
            targetKind: caseRows[0].targetKind,
            targetId: caseRows[0].targetId,
            actorKind: "USER",
            actorUserId: user.id,
            actionKind: "ESCALATE",
            reasonCode: "ESCALATED",
            reasonText: payload.reason ?? null,
            caseId: params.caseId,
          });
          yield* insertAudit({
            actorUserId: user.id,
            action: "REALM_CASE_ESCALATE",
            targetKind: "CASE",
            targetId: params.caseId,
            decisionCode: "ESCALATED",
            reason: payload.reason ?? "Realm case escalated to platform",
          });
          return toModerationCaseDTO(escalatedRows[0]!);
        }).pipe(Effect.orDie),
      )

      // ── listAuditLogs — list staff audit log entries ──────────────
      // 列出 staff 审计日志条目
      .handle("listAuditLogs", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const conditions: ReturnType<typeof eq>[] = [];
          if (query.actorUserId) conditions.push(eq(StaffAuditLog.actorUserId, query.actorUserId));
          if (query.action) conditions.push(eq(StaffAuditLog.action, query.action));
          if (query.targetKind) conditions.push(eq(StaffAuditLog.targetKind, query.targetKind));
          if (query.targetId) conditions.push(eq(StaffAuditLog.targetId, query.targetId));
          if (query.decisionCode) conditions.push(eq(StaffAuditLog.decisionCode, query.decisionCode));
          if (query.requestId) conditions.push(eq(StaffAuditLog.requestId, query.requestId));
          const where = conditions.length > 0 ? and(...conditions) : undefined;
          const rows = yield*
            database
              .select()
              .from(StaffAuditLog)
              .where(where)
              .orderBy(desc(StaffAuditLog.createdAt))
              .limit(lim(query.limit))
              .offset(query.offset ?? 0);
          return rows.map(toStaffAuditLogDTO);
        }).pipe(Effect.orDie),
      )

      // ── getAuditLog — fetch a single audit log entry ──────────────
      // 获取单条审计日志条目
      .handle("getAuditLog", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* requireStaff(user.id);
          const rows = yield*
            database.select().from(StaffAuditLog).where(eq(StaffAuditLog.id, params.auditLogId)).limit(1);
          if (!rows[0]) return yield* new GovernanceNotFound();
          return toStaffAuditLogDTO(rows[0]);
        }).pipe(Effect.orDie),
      );
  }),
);
