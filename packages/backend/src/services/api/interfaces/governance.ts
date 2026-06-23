import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class CapabilityHintsResult extends Schema.Class<CapabilityHintsResult>("CapabilityHintsResult")({
  capabilities: Schema.Array(Schema.Any),
}) {}

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
  state: Schema.optional(Schema.String),
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
      error: Unauthorized,
    }).middleware(AuthMiddleware),
  )
  // --- Realm capabilities ---
  // --- Realm 能力授予/撤销 ---
  .add(
    // POST /governance/realms/:realmUnitId/members/:userId/capabilities — grant
    // 授予 Realm 成员能力
    HttpApiEndpoint.post("grantRealmCapability", "/realms/:realmUnitId/members/:userId/capabilities", {
      params: { realmUnitId: Schema.String, userId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    // DELETE /governance/realms/:realmUnitId/members/:userId/capabilities/:capability — revoke
    // 撤销 Realm 成员能力
    HttpApiEndpoint.delete("revokeRealmCapability", "/realms/:realmUnitId/members/:userId/capabilities/:capability", {
      params: { realmUnitId: Schema.String, userId: Schema.String, capability: Schema.String },
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Policy decide ---
  // --- 策略决策 ---
  .add(
    // POST /governance/policy/decide — evaluate a governance policy decision
    // 评估治理策略决策
    HttpApiEndpoint.post("policyDecide", "/policy/decide", {
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Moderation actions & overlays ---
  // --- 审核动作与叠加层 ---
  .add(
    // GET /governance/moderation/:targetKind/:targetId/actions — list moderation actions
    // 列出审核动作
    HttpApiEndpoint.get("listModerationActions", "/moderation/:targetKind/:targetId/actions", {
      params: { targetKind: Schema.String, targetId: Schema.String },
      query: ListQuery,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    // POST /governance/moderation/overlays — read moderation overlays
    // 读取审核叠加层
    HttpApiEndpoint.post("listModerationOverlays", "/moderation/overlays", {
      payload: Schema.Any,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Global content moderation ---
  // --- 全局内容审核 ---
  .add(
    HttpApiEndpoint.post("contentApprove", "/content/:targetUnitId/approve", {
      params: { targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("contentRemove", "/content/:targetUnitId/remove", {
      params: { targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("contentRestore", "/content/:targetUnitId/restore", {
      params: { targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Realm-scoped content moderation ---
  // --- Realm 范围内容审核 ---
  .add(
    HttpApiEndpoint.post("realmContentApprove", "/realms/:realmUnitId/content/:targetUnitId/approve", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentRemove", "/realms/:realmUnitId/content/:targetUnitId/remove", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentRestore", "/realms/:realmUnitId/content/:targetUnitId/restore", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentLock", "/realms/:realmUnitId/content/:targetUnitId/lock", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentUnlock", "/realms/:realmUnitId/content/:targetUnitId/unlock", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("realmContentOwnerDelegation", "/realms/:realmUnitId/content/:targetUnitId/owner-delegation", {
      params: { realmUnitId: Schema.String, targetUnitId: Schema.String },
      payload: ContentModerationBody,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Enforcement ---
  // --- 执行措施 ---
  .add(
    // GET /governance/enforcement/:targetUserId/active — active enforcement summary
    // 获取活跃执行措施摘要
    HttpApiEndpoint.get("getActiveEnforcement", "/enforcement/:targetUserId/active", {
      params: { targetUserId: Schema.String },
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    // GET /governance/enforcement/:targetUserId — list enforcement records
    // 列出执行措施记录
    HttpApiEndpoint.get("listEnforcements", "/enforcement/:targetUserId", {
      params: { targetUserId: Schema.String },
      query: ListQuery,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    // POST /governance/enforcement/:targetUserId — apply enforcement
    // 应用执行措施
    HttpApiEndpoint.post("applyEnforcement", "/enforcement/:targetUserId", {
      params: { targetUserId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    // POST /governance/enforcement/:targetUserId/unblock — unblock account
    // 解除账户封禁
    HttpApiEndpoint.post("unblockEnforcement", "/enforcement/:targetUserId/unblock", {
      params: { targetUserId: Schema.String },
      payload: Schema.Any,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Cases — global ---
  // --- 案例 — 全局 ---
  .add(
    HttpApiEndpoint.get("listCases", "/cases", {
      query: ListQuery,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("getCase", "/cases/:caseId", {
      params: { caseId: Schema.String },
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("listCaseActions", "/cases/:caseId/actions", {
      params: { caseId: Schema.String },
      query: ListQuery,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("createCaseFromFeedback", "/cases/from-feedback/:feedbackId", {
      params: { feedbackId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("duplicateCase", "/cases/:caseId/duplicate", {
      params: { caseId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("assignCase", "/cases/:caseId/assign", {
      params: { caseId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("triageCase", "/cases/:caseId/triage", {
      params: { caseId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("decideCase", "/cases/:caseId/decision", {
      params: { caseId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("appealCase", "/cases/:caseId/appeal", {
      params: { caseId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Cases — realm-scoped ---
  // --- 案例 — Realm 范围 ---
  .add(
    HttpApiEndpoint.get("listRealmCases", "/realms/:realmUnitId/cases", {
      params: { realmUnitId: Schema.String },
      query: ListQuery,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("createRealmCase", "/realms/:realmUnitId/cases", {
      params: { realmUnitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("createRealmCaseFromFeedback", "/realms/:realmUnitId/cases/from-feedback/:feedbackId", {
      params: { realmUnitId: Schema.String, feedbackId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("listRealmCaseActions", "/realms/:realmUnitId/cases/:caseId/actions", {
      params: { realmUnitId: Schema.String, caseId: Schema.String },
      query: ListQuery,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("decideRealmCase", "/realms/:realmUnitId/cases/:caseId/decision", {
      params: { realmUnitId: Schema.String, caseId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("escalateRealmCase", "/realms/:realmUnitId/cases/:caseId/escalate", {
      params: { realmUnitId: Schema.String, caseId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),
  )
  // --- Audit ---
  // --- 审计日志 ---
  .add(
    // GET /governance/audit — list audit records
    // 列出审计记录
    HttpApiEndpoint.get("listAuditLogs", "/audit", {
      query: AuditListQuery,
      success: Schema.Array(Schema.Any),
      error: [Unauthorized, GovernanceForbidden],
    }).middleware(AuthMiddleware),

    // GET /governance/audit/:auditLogId — read single audit record
    // 读取单条审计记录
    HttpApiEndpoint.get("getAuditLog", "/audit/:auditLogId", {
      params: { auditLogId: Schema.String },
      success: Schema.Any,
      error: [Unauthorized, GovernanceForbidden, GovernanceNotFound],
    }).middleware(AuthMiddleware),
  )
  .prefix("/governance") {}
