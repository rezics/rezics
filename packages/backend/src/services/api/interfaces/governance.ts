import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// DTO schemas — typed representations of database rows returned by handlers
// DTO schema —— handler 返回的数据库行的类型化表示
// ---------------------------------------------------------------------------

/**
 * Single capability hint entry (staff or realm grant).
 * 单个能力提示条目（staff 或 realm 授权）。
 */
export class CapabilityHintEntry extends Schema.Class<CapabilityHintEntry>("CapabilityHintEntry")({
  kind: Schema.String,
  capability: Schema.String,
  scopeKind: Schema.optional(Schema.String),
  realmUnitId: Schema.optional(Schema.NullOr(Schema.String)),
}) {}

export class CapabilityHintsResult extends Schema.Class<CapabilityHintsResult>("CapabilityHintsResult")({
  capabilities: Schema.Array(CapabilityHintEntry),
}) {}

/**
 * Realm capability grant row returned after grant/revoke.
 * 授予/撤销后返回的 Realm 能力授权行。
 */
export class RealmCapabilityGrantDTO extends Schema.Class<RealmCapabilityGrantDTO>("RealmCapabilityGrantDTO")({
  id: Schema.String,
  realmUnitId: Schema.String,
  userId: Schema.String,
  capability: Schema.String,
  state: Schema.String,
  grantedById: Schema.String,
  revokedById: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(Schema.String),
  revokedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

/**
 * Policy decision result.
 * 策略决策结果。
 */
export class PolicyDecisionResult extends Schema.Class<PolicyDecisionResult>("PolicyDecisionResult")({
  allowed: Schema.Boolean,
  actor: Schema.String,
  action: Schema.String,
  grants: Schema.Array(Schema.String),
}) {}

/**
 * Moderation action row.
 * 审核动作行。
 */
export class ModerationActionDTO extends Schema.Class<ModerationActionDTO>("ModerationActionDTO")({
  id: Schema.String,
  authority: Schema.String,
  realmUnitId: Schema.NullOr(Schema.String),
  targetKind: Schema.String,
  targetId: Schema.String,
  targetPath: Schema.NullOr(Schema.String),
  actorKind: Schema.String,
  actorUserId: Schema.NullOr(Schema.String),
  actionKind: Schema.String,
  resultingStatus: Schema.NullOr(Schema.String),
  resultingLocked: Schema.NullOr(Schema.Boolean),
  reasonCode: Schema.String,
  reasonText: Schema.NullOr(Schema.String),
  publicMessage: Schema.NullOr(Schema.String),
  caseId: Schema.NullOr(Schema.String),
  reversesActionId: Schema.NullOr(Schema.String),
  requestId: Schema.NullOr(Schema.String),
  idempotencyKey: Schema.NullOr(Schema.String),
  importedFrom: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
}) {}

/**
 * Account enforcement row.
 * 账户执行措施行。
 */
export class AccountEnforcementDTO extends Schema.Class<AccountEnforcementDTO>("AccountEnforcementDTO")({
  id: Schema.String,
  targetUserId: Schema.String,
  kind: Schema.String,
  state: Schema.String,
  reason: Schema.String,
  safeMessage: Schema.NullOr(Schema.String),
  decidedById: Schema.String,
  decisionCode: Schema.String,
  startsAt: Schema.String,
  expiresAt: Schema.NullOr(Schema.String),
  revokedAt: Schema.NullOr(Schema.String),
  revokedById: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  decisionActionId: Schema.NullOr(Schema.String),
  revocationActionId: Schema.NullOr(Schema.String),
}) {}

/**
 * Active enforcement summary.
 * 活跃执行措施摘要。
 */
export class ActiveEnforcementResult extends Schema.Class<ActiveEnforcementResult>("ActiveEnforcementResult")({
  targetUserId: Schema.String,
  active: Schema.Array(AccountEnforcementDTO),
  count: Schema.Number,
}) {}

/**
 * Moderation case row.
 * 审核案例行。
 */
export class ModerationCaseDTO extends Schema.Class<ModerationCaseDTO>("ModerationCaseDTO")({
  id: Schema.String,
  state: Schema.String,
  severity: Schema.NullOr(Schema.String),
  reporterUserId: Schema.NullOr(Schema.String),
  subjectUserId: Schema.NullOr(Schema.String),
  targetKind: Schema.String,
  targetId: Schema.String,
  addressedUnitId: Schema.NullOr(Schema.String),
  realmUnitId: Schema.NullOr(Schema.String),
  sourceFeedbackId: Schema.NullOr(Schema.String),
  assignedToUserId: Schema.NullOr(Schema.String),
  duplicateOfCaseId: Schema.NullOr(Schema.String),
  reason: Schema.NullOr(Schema.String),
  safeSummary: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  parentCaseId: Schema.NullOr(Schema.String),
  scope: Schema.String,
}) {}

/**
 * Staff audit log row.
 * Staff 审计日志行。
 */
export class StaffAuditLogDTO extends Schema.Class<StaffAuditLogDTO>("StaffAuditLogDTO")({
  id: Schema.String,
  actorUserId: Schema.String,
  action: Schema.String,
  targetKind: Schema.String,
  targetId: Schema.String,
  decisionCode: Schema.String,
  requestId: Schema.NullOr(Schema.String),
  reason: Schema.String,
  metadata: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.String,
}) {}

// ---------------------------------------------------------------------------
// Payload schemas — typed request bodies for each endpoint
// 请求体 schema —— 每个端点的类型化请求体
// ---------------------------------------------------------------------------

const GrantRealmCapabilityPayload = Schema.Struct({
  capability: Schema.String,
  reason: Schema.optional(Schema.String),
});

const PolicyDecidePayload = Schema.Struct({
  action: Schema.optional(Schema.String),
});

const ModerationOverlaysPayload = Schema.Struct({
  unitIds: Schema.Array(Schema.String),
});

const ApplyEnforcementPayload = Schema.Struct({
  kind: Schema.optional(Schema.Literals(["WARNING", "SILENCE", "SUSPENSION", "BAN", "RATE_LIMIT", "TRUST_RESTRICTION"])),
  reason: Schema.optional(Schema.String),
  decisionCode: Schema.optional(Schema.String),
  expiresAt: Schema.optional(Schema.String),
  caseId: Schema.optional(Schema.String),
  safeMessage: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Unknown),
});

const UnblockEnforcementPayload = Schema.Struct({
  reason: Schema.optional(Schema.String),
});

const CreateCaseFromFeedbackPayload = Schema.Struct({
  reason: Schema.optional(Schema.String),
  severity: Schema.optional(Schema.String),
});

const DuplicateCasePayload = Schema.Struct({
  duplicateOfCaseId: Schema.String,
});

const AssignCasePayload = Schema.Struct({
  assignedToUserId: Schema.optional(Schema.String),
});

const TriageCasePayload = Schema.Struct({
  severity: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
});

const DecideCasePayload = Schema.Struct({
  decisionCode: Schema.optional(Schema.String),
  actionKind: Schema.optional(Schema.Literals(["APPROVE", "REMOVE", "RESTORE", "LOCK", "UNLOCK", "FIELD_LOCK", "FIELD_UNLOCK", "WARNING", "SILENCE", "SUSPENSION", "BAN", "RATE_LIMIT", "TRUST_RESTRICTION", "REVOKE_ENFORCEMENT", "MUTE_MEMBER", "REMOVE_MEMBER", "BAN_MEMBER", "RESTORE_MEMBER", "ESCALATE", "REVERSE", "NOTE"])),
  reason: Schema.optional(Schema.String),
});

const AppealCasePayload = Schema.Struct({
  reason: Schema.optional(Schema.String),
  severity: Schema.optional(Schema.String),
});

const CreateRealmCasePayload = Schema.Struct({
  targetKind: Schema.optional(Schema.Literals(["UNIT", "UNIT_REALM", "COMMENT", "UNIT_FIELD", "ACCOUNT", "REALM_MEMBER", "FEEDBACK"])),
  targetId: Schema.optional(Schema.String),
  addressedUnitId: Schema.optional(Schema.String),
  subjectUserId: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  severity: Schema.optional(Schema.String),
});

const EscalateRealmCasePayload = Schema.Struct({
  reason: Schema.optional(Schema.String),
  severity: Schema.optional(Schema.String),
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GovernanceForbidden extends Schema.TaggedErrorClass<GovernanceForbidden>()(
  "GovernanceForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class GovernanceNotFound extends Schema.TaggedErrorClass<GovernanceNotFound>()(
  "GovernanceNotFound",
  {},
  { httpApiStatus: 404 },
) {}

// ---------------------------------------------------------------------------
// Shared param / body helpers
// 共享参数/请求体助手
// ---------------------------------------------------------------------------

const ListQuery = Schema.Struct({
  offset: Schema.optional(Schema.NumberFromString),
  limit: Schema.optional(Schema.NumberFromString),
  scope: Schema.optional(Schema.String),
  state: Schema.optional(
    Schema.Literals(["NEW", "TRIAGED", "ASSIGNED", "ACTIONED", "RESOLVED", "DUPLICATE", "REJECTED", "ESCALATED", "REVIEWING", "ACTIVE", "EXPIRED", "REVOKED"]),
  ),
});

const AuditListQuery = Schema.Struct({
  offset: Schema.optional(Schema.NumberFromString),
  limit: Schema.optional(Schema.NumberFromString),
  actorUserId: Schema.optional(Schema.String),
  action: Schema.optional(Schema.String),
  targetKind: Schema.optional(Schema.String),
  targetId: Schema.optional(Schema.String),
  decisionCode: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
});

const ContentModerationBody = Schema.Struct({
  reason: Schema.optional(Schema.String),
  caseId: Schema.optional(Schema.String),
});

// ---------------------------------------------------------------------------
// /governance — moderation + enforcement + cases + audit + capabilities
// /governance — 审核 + 执行措施 + 案例 + 审计 + 能力
// ---------------------------------------------------------------------------

export class GovernanceGroup extends HttpApiGroup.make("governance")
  // --- Capability hints ---
  // --- 能力提示 ---
  .add(
    // GET /governance/capability-hints/me — resolve current user capability hints
    // 解析当前用户的能力提示
    HttpApiEndpoint.get("capabilityHintsMe", "/capability-hints/me", {
      success: CapabilityHintsResult,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Realm capabilities ---
  // --- Realm 能力授予/撤销 ---
  .add(
    // POST /governance/realms/:realmUnitId/members/:userId/capabilities — grant
    // 授予 Realm 成员能力
    HttpApiEndpoint.post("grantRealmCapability", "/realms/:realmUnitId/members/:userId/capabilities", {
      params: { realmUnitId: Schema.String, userId: Schema.String },
      payload: GrantRealmCapabilityPayload,
      success: RealmCapabilityGrantDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /governance/realms/:realmUnitId/members/:userId/capabilities/:capability — revoke
    // 撤销 Realm 成员能力
    HttpApiEndpoint.delete("revokeRealmCapability", "/realms/:realmUnitId/members/:userId/capabilities/:capability", {
      params: { realmUnitId: Schema.String, userId: Schema.String, capability: Schema.String },
      success: Schema.Array(RealmCapabilityGrantDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Policy decide ---
  // --- 策略决策 ---
  .add(
    // POST /governance/policy/decide — evaluate a governance policy decision
    // 评估治理策略决策
    HttpApiEndpoint.post("policyDecide", "/policy/decide", {
      payload: PolicyDecidePayload,
      success: PolicyDecisionResult,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Moderation actions & overlays ---
  // --- 审核动作与叠加层 ---
  .add(
    // GET /governance/moderation/:targetKind/:targetId/actions — list moderation actions
    // 列出审核动作
    HttpApiEndpoint.get("listModerationActions", "/moderation/:targetKind/:targetId/actions", {
      params: { targetKind: Schema.Literals(["UNIT", "UNIT_REALM", "COMMENT", "UNIT_FIELD", "ACCOUNT", "REALM_MEMBER", "FEEDBACK"]), targetId: Schema.String },
      query: ListQuery,
      success: Schema.Array(ModerationActionDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /governance/moderation/overlays — read moderation overlays
    // 读取审核叠加层
    HttpApiEndpoint.post("listModerationOverlays", "/moderation/overlays", {
      payload: ModerationOverlaysPayload,
      success: Schema.Array(ModerationActionDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Global content moderation ---
  // --- 全局内容审核 ---
  .add(
    HttpApiEndpoint.post("contentApprove", "/content/:targetUnitId/approve", {
      params: { targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Array(ModerationActionDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("contentRemove", "/content/:targetUnitId/remove", {
      params: { targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Array(ModerationActionDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("contentRestore", "/content/:targetUnitId/restore", {
      params: { targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Array(ModerationActionDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Realm-scoped content moderation ---
  // --- Realm 范围内容审核 ---
  .add(
    HttpApiEndpoint.post("realmContentApprove", "/realms/:realmUnitId/content/:targetUnitId/approve", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: ModerationActionDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentRemove", "/realms/:realmUnitId/content/:targetUnitId/remove", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: ModerationActionDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentRestore", "/realms/:realmUnitId/content/:targetUnitId/restore", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: ModerationActionDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentLock", "/realms/:realmUnitId/content/:targetUnitId/lock", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: ModerationActionDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentUnlock", "/realms/:realmUnitId/content/:targetUnitId/unlock", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: ModerationActionDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentOwnerDelegation", "/realms/:realmUnitId/content/:targetUnitId/owner-delegation", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: ModerationActionDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Enforcement ---
  // --- 执行措施 ---
  .add(
    // GET /governance/enforcement/:targetUserId/active — active enforcement summary
    // 获取活跃执行措施摘要
    HttpApiEndpoint.get("getActiveEnforcement", "/enforcement/:targetUserId/active", {
      params: { targetUserId: Schema.String },
      success: ActiveEnforcementResult,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /governance/enforcement/:targetUserId — list enforcement records
    // 列出执行措施记录
    HttpApiEndpoint.get("listEnforcements", "/enforcement/:targetUserId", {
      params: { targetUserId: Schema.String },
      query: ListQuery,
      success: Schema.Array(AccountEnforcementDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /governance/enforcement/:targetUserId — apply enforcement
    // 应用执行措施
    HttpApiEndpoint.post("applyEnforcement", "/enforcement/:targetUserId", {
      params: { targetUserId: Schema.String },
      payload: ApplyEnforcementPayload,
      success: AccountEnforcementDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /governance/enforcement/:targetUserId/unblock — unblock account
    // 解除账户封禁
    HttpApiEndpoint.post("unblockEnforcement", "/enforcement/:targetUserId/unblock", {
      params: { targetUserId: Schema.String },
      payload: UnblockEnforcementPayload,
      success: Schema.Array(AccountEnforcementDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Cases — global ---
  // --- 案例 — 全局 ---
  .add(
    HttpApiEndpoint.get("listCases", "/cases", {
      query: ListQuery,
      success: Schema.Array(ModerationCaseDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("getCase", "/cases/:caseId", {
      params: { caseId: Schema.String },
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("listCaseActions", "/cases/:caseId/actions", {
      params: { caseId: Schema.String },
      query: ListQuery,
      success: Schema.Array(ModerationActionDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("createCaseFromFeedback", "/cases/from-feedback/:feedbackId", {
      params: { feedbackId: Schema.String },
      payload: CreateCaseFromFeedbackPayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("duplicateCase", "/cases/:caseId/duplicate", {
      params: { caseId: Schema.String },
      payload: DuplicateCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("assignCase", "/cases/:caseId/assign", {
      params: { caseId: Schema.String },
      payload: AssignCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("triageCase", "/cases/:caseId/triage", {
      params: { caseId: Schema.String },
      payload: TriageCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("decideCase", "/cases/:caseId/decision", {
      params: { caseId: Schema.String },
      payload: DecideCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("appealCase", "/cases/:caseId/appeal", {
      params: { caseId: Schema.String },
      payload: AppealCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Cases — realm-scoped ---
  // --- 案例 — Realm 范围 ---
  .add(
    HttpApiEndpoint.get("listRealmCases", "/realms/:realmUnitId/cases", {
      params: { realmUnitId: Schema.String },
      query: ListQuery,
      success: Schema.Array(ModerationCaseDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("createRealmCase", "/realms/:realmUnitId/cases", {
      params: { realmUnitId: Schema.String },
      payload: CreateRealmCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("createRealmCaseFromFeedback", "/realms/:realmUnitId/cases/from-feedback/:feedbackId", {
      params: { realmUnitId: Schema.String, feedbackId: Schema.String },
      payload: CreateCaseFromFeedbackPayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("listRealmCaseActions", "/realms/:realmUnitId/cases/:caseId/actions", {
      params: { realmUnitId: Schema.String, caseId: Schema.String },
      query: ListQuery,
      success: Schema.Array(ModerationActionDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("decideRealmCase", "/realms/:realmUnitId/cases/:caseId/decision", {
      params: { realmUnitId: Schema.String, caseId: Schema.String },
      payload: DecideCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("escalateRealmCase", "/realms/:realmUnitId/cases/:caseId/escalate", {
      params: { realmUnitId: Schema.String, caseId: Schema.String },
      payload: EscalateRealmCasePayload,
      success: ModerationCaseDTO,
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  // --- Audit ---
  // --- 审计日志 ---
  .add(
    // GET /governance/audit — list audit records
    // 列出审计记录
    HttpApiEndpoint.get("listAuditLogs", "/audit", {
      query: AuditListQuery,
      success: Schema.Array(StaffAuditLogDTO),
      error: [Unauthorized, GovernanceForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /governance/audit/:auditLogId — read single audit record
    // 读取单条审计记录
    HttpApiEndpoint.get("getAuditLog", "/audit/:auditLogId", {
      params: { auditLogId: Schema.String },
      success: StaffAuditLogDTO,
      error: [Unauthorized, GovernanceForbidden, GovernanceNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/governance") {}
