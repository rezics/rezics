import {
  accountEnforcementDTOSchema,
  activeAccountEnforcementSummarySchema,
  appealModerationCaseSchema,
  assignModerationCaseSchema,
  capabilityGrantDTOSchema,
  capabilityHintSchema,
  contentModerationDecisionSchema,
  createAccountEnforcementSchema,
  createModerationCaseFromFeedbackSchema,
  createRealmModerationCaseFromFeedbackSchema,
  createRealmModerationCaseSchema,
  decideModerationCaseSchema,
  decideRealmModerationCaseSchema,
  duplicateModerationCaseSchema,
  escalateRealmModerationCaseSchema,
  grantCapabilitySchema,
  moderationActionDTOSchema,
  moderationCaseDTOSchema,
  moderationOverlayDTOSchema,
  moderationOverlayRequestSchema,
  policyDecisionSchema,
  policyInputSchema,
  staffAuditLogDTOSchema,
  triageModerationCaseSchema,
  unblockAccountEnforcementSchema,
  unitRealmDTOSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { accountPolicyActions } from "./action/account";
import { contentPolicyActions } from "./action/content";
import { realmPolicyActions } from "./action/realm";
import { sitePolicyActions } from "./action/site";
import { governanceAuditService } from "./audit.service";
import { governanceCapabilityService } from "./capability.service";
import { governanceEnforcementService } from "./enforcement.service";
import { governanceModerationService } from "./moderation.service";
import { decide } from "./policy";
import { governanceRoutePolicyService } from "./route-policy.service";

async function assertStaff(identity: any, status: any) {
  if (!isAdminRole(identity)) return status(403, "Forbidden: Staff required");
  if (!(await verifyAdminFromDb(identity.userId))) {
    return status(403, "Forbidden: Staff required");
  }
}

const listQuerySchema = t.Object({
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
  scope: t.Optional(t.String()),
  state: t.Optional(t.String()),
});

const auditListQuerySchema = t.Object({
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
  actorUserId: t.Optional(t.String()),
  action: t.Optional(t.String()),
  targetKind: t.Optional(t.String()),
  targetId: t.Optional(t.String()),
  decisionCode: t.Optional(t.String()),
  requestId: t.Optional(t.String()),
});

function accountEnforcementAction(kind: string) {
  switch (kind) {
    case "warning":
      return accountPolicyActions.warn;
    case "silence":
      return accountPolicyActions.silence;
    case "suspension":
      return accountPolicyActions.suspend;
    case "ban":
      return accountPolicyActions.ban;
    case "rate_limit":
    case "trust_restriction":
      return accountPolicyActions.rateLimit;
    default:
      return accountPolicyActions.warn;
  }
}

function realmCaseDecisionKind(actionKind: string) {
  switch (actionKind) {
    case "approve":
      return "approve_for_realm";
    case "remove":
      return "remove_from_realm";
    case "warning":
      return "warn";
    case "ban_member":
      return "ban_from_realm";
    default:
      return actionKind;
  }
}

async function decideGovernancePolicy(input: {
  identity: any;
  action: Parameters<
    typeof governanceRoutePolicyService.decideForIdentity
  >[0]["action"];
  target: {
    kind: string;
    id: string;
  };
}) {
  return governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: input.action,
    target: input.target,
  });
}

async function assertGovernancePolicy(
  input: Parameters<typeof decideGovernancePolicy>[0] & {
    status: any;
  },
) {
  const decision = await decideGovernancePolicy(input);
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

async function assertRealmGovernancePolicy(input: {
  identity: any;
  status: any;
  realmUnitId: string;
  action: Parameters<
    typeof governanceRoutePolicyService.decideForIdentity
  >[0]["action"];
  target: { kind: string; id: string; realmUnitId: string };
}) {
  const realmMembership =
    await governanceCapabilityService.realmMembershipForPolicy(
      input.realmUnitId,
      input.identity.userId,
    );
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: input.action,
    realmMembership,
    target: input.target,
  });
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

export const governanceApi = new Elysia({ prefix: "/governance" })
  .use(authMacro)
  .get(
    "/capability-hints/me",
    async ({ identity }) => ({
      capabilities: await governanceCapabilityService.resolveHintsForIdentity({
        userId: identity.userId,
        permission: identity.permission,
      }),
    }),
    {
      requireLogin: true,
      response: {
        200: t.Object({ capabilities: t.Array(capabilityHintSchema) }),
      },
      detail: {
        summary: "Resolve current-user governance capability hints",
        tags: ["Governance"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/members/:userId/capabilities",
    async ({ params, body, identity, status }) => {
      const realmMembership =
        await governanceCapabilityService.realmMembershipForPolicy(
          params.realmUnitId,
          identity.userId,
        );
      const decision = await governanceRoutePolicyService.decideForIdentity({
        identity,
        action: realmPolicyActions.memberCapabilityChange,
        realmMembership,
        target: {
          kind: "realm-member-capability",
          id: params.userId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (!decision.allowed) {
        return status(
          403,
          decision.safeMessage ?? "Forbidden: policy denied this action",
        );
      }
      return governanceCapabilityService.grantRealmCapability({
        realmUnitId: params.realmUnitId,
        userId: params.userId,
        capability: body.capability,
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt } : {}),
        grantedById: identity.userId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), userId: t.String() }),
      body: grantCapabilitySchema,
      response: {
        200: capabilityGrantDTOSchema,
        403: t.String(),
      },
      detail: {
        summary: "Grant a realm member capability",
        tags: ["Governance", "Realms"],
      },
    },
  )
  .delete(
    "/realms/:realmUnitId/members/:userId/capabilities/:capability",
    async ({ params, identity, status }) => {
      const realmMembership =
        await governanceCapabilityService.realmMembershipForPolicy(
          params.realmUnitId,
          identity.userId,
        );
      const decision = await governanceRoutePolicyService.decideForIdentity({
        identity,
        action: realmPolicyActions.memberCapabilityChange,
        realmMembership,
        target: {
          kind: "realm-member-capability",
          id: params.userId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (!decision.allowed) {
        return status(
          403,
          decision.safeMessage ?? "Forbidden: policy denied this action",
        );
      }
      return governanceCapabilityService.revokeRealmCapability({
        realmUnitId: params.realmUnitId,
        userId: params.userId,
        capability: params.capability as never,
        revokedById: identity.userId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({
        realmUnitId: t.String(),
        userId: t.String(),
        capability: t.String(),
      }),
      response: {
        200: t.Array(capabilityGrantDTOSchema),
        403: t.String(),
      },
      detail: {
        summary: "Revoke a realm member capability",
        tags: ["Governance", "Realms"],
      },
    },
  )
  .post(
    "/policy/decide",
    async ({ body, identity, status }) => {
      const denied = await assertStaff(identity, status);
      if (denied) return denied;
      return decide(body);
    },
    {
      requireLogin: true,
      body: policyInputSchema,
      response: { 200: policyDecisionSchema, 403: t.String() },
      detail: {
        summary: "Evaluate a governance policy decision",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/moderation/:targetKind/:targetId/actions",
    async ({ params, query, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: {
          kind: params.targetKind,
          id: params.targetId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.listTargetActions(
        params.targetKind.toUpperCase() as never,
        params.targetId,
        query,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ targetKind: t.String(), targetId: t.String() }),
      query: listQuerySchema,
      response: {
        200: t.Array(moderationActionDTOSchema),
        403: t.String(),
      },
      detail: {
        summary: "List moderation actions for a target",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/moderation/overlays",
    async ({ body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: {
          kind: body.targetKind,
          id: body.realmUnitId ?? body.targetIds.join(","),
        },
      });
      if (denied) return denied;
      return governanceModerationService.listModerationOverlays(body);
    },
    {
      requireLogin: true,
      body: moderationOverlayRequestSchema,
      response: {
        200: t.Array(moderationOverlayDTOSchema),
        403: t.String(),
      },
      detail: {
        summary: "Read moderation overlays for visible targets",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/enforcement/:targetUserId/active",
    async ({ params, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: { kind: "account-enforcement", id: params.targetUserId },
      });
      if (denied) return denied;
      return governanceEnforcementService.activeSummary(params.targetUserId);
    },
    {
      requireLogin: true,
      params: t.Object({ targetUserId: t.String() }),
      response: { 200: activeAccountEnforcementSummarySchema, 403: t.String() },
      detail: {
        summary: "Read active account enforcement summary",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/enforcement/:targetUserId",
    async ({ params, query, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: { kind: "account-enforcement", id: params.targetUserId },
      });
      if (denied) return denied;
      return governanceEnforcementService.list(params.targetUserId, query);
    },
    {
      requireLogin: true,
      params: t.Object({ targetUserId: t.String() }),
      query: listQuerySchema,
      response: { 200: t.Array(accountEnforcementDTOSchema), 403: t.String() },
      detail: {
        summary: "List account enforcement records",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/enforcement/:targetUserId",
    async ({ params, body, identity, status }) => {
      const decision = await decideGovernancePolicy({
        identity,
        action: accountEnforcementAction(body.kind),
        target: { kind: "account", id: params.targetUserId },
      });
      if (!decision.allowed) {
        return status(
          403,
          decision.safeMessage ?? "Forbidden: policy denied this action",
        );
      }
      return governanceEnforcementService.apply(params.targetUserId, {
        ...body,
        decidedById: identity.userId,
        decisionCode: decision.code,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ targetUserId: t.String() }),
      body: createAccountEnforcementSchema,
      response: { 200: accountEnforcementDTOSchema, 403: t.String() },
      detail: {
        summary: "Apply account enforcement",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/enforcement/:targetUserId/unblock",
    async ({ params, body, identity, status }) => {
      const decision = await decideGovernancePolicy({
        identity,
        action: accountPolicyActions.unblock,
        target: { kind: "account", id: params.targetUserId },
      });
      if (!decision.allowed) {
        return status(
          403,
          decision.safeMessage ?? "Forbidden: policy denied this action",
        );
      }
      return governanceEnforcementService.unblock(params.targetUserId, {
        ...body,
        revokedById: identity.userId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ targetUserId: t.String() }),
      body: unblockAccountEnforcementSchema,
      response: { 200: t.Array(accountEnforcementDTOSchema), 403: t.String() },
      detail: {
        summary: "Unblock an account",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/content/:targetUnitId/approve",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: contentPolicyActions.restore,
        target: { kind: "content", id: params.targetUnitId },
      });
      if (denied) return denied;
      await governanceModerationService.setUnitModerationStatus({
        unitId: params.targetUnitId,
        actorUserId: identity.userId,
        action: "approve",
        reasonCode: "content.approved",
        reasonText: body.reason,
        caseId: body.caseId,
      });
      return governanceModerationService.listTargetActions(
        "UNIT",
        params.targetUnitId,
        { limit: 1 },
      );
    },
    {
      requireLogin: true,
      params: t.Object({ targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: t.Array(moderationActionDTOSchema), 403: t.String() },
      detail: {
        summary: "Approve content globally",
        tags: ["Governance", "Content"],
      },
    },
  )
  .post(
    "/content/:targetUnitId/remove",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: contentPolicyActions.takedown,
        target: { kind: "content", id: params.targetUnitId },
      });
      if (denied) return denied;
      await governanceModerationService.setUnitModerationStatus({
        unitId: params.targetUnitId,
        actorUserId: identity.userId,
        action: "remove",
        reasonCode: "content.removed",
        reasonText: body.reason,
        caseId: body.caseId,
      });
      return governanceModerationService.listTargetActions(
        "UNIT",
        params.targetUnitId,
        { limit: 1 },
      );
    },
    {
      requireLogin: true,
      params: t.Object({ targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: t.Array(moderationActionDTOSchema), 403: t.String() },
      detail: {
        summary: "Remove content globally",
        tags: ["Governance", "Content"],
      },
    },
  )
  .post(
    "/content/:targetUnitId/restore",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: contentPolicyActions.restore,
        target: { kind: "content", id: params.targetUnitId },
      });
      if (denied) return denied;
      await governanceModerationService.setUnitModerationStatus({
        unitId: params.targetUnitId,
        actorUserId: identity.userId,
        action: "restore",
        reasonCode: "content.restored",
        reasonText: body.reason,
        caseId: body.caseId,
      });
      return governanceModerationService.listTargetActions(
        "UNIT",
        params.targetUnitId,
        { limit: 1 },
      );
    },
    {
      requireLogin: true,
      params: t.Object({ targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: t.Array(moderationActionDTOSchema), 403: t.String() },
      detail: {
        summary: "Restore global content moderation state",
        tags: ["Governance", "Content"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/content/:targetUnitId/approve",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: realmPolicyActions.queueDecide,
        target: {
          kind: "realm-content",
          id: params.targetUnitId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.setRealmUnitModerationStatus({
        realmUnitId: params.realmUnitId,
        unitId: params.targetUnitId,
        actorUserId: identity.userId,
        action: "approve",
        reasonCode: "realm.content.approved",
        reasonText: body.reason,
        caseId: body.caseId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: unitRealmDTOSchema, 403: t.String() },
      detail: {
        summary: "Approve content for one realm",
        tags: ["Governance", "Realms", "Content"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/content/:targetUnitId/restore",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: contentPolicyActions.restore,
        target: {
          kind: "realm-content",
          id: params.targetUnitId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.setRealmUnitModerationStatus({
        realmUnitId: params.realmUnitId,
        unitId: params.targetUnitId,
        actorUserId: identity.userId,
        action: "restore",
        reasonCode: "realm.content.restored",
        reasonText: body.reason,
        caseId: body.caseId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: unitRealmDTOSchema, 403: t.String() },
      detail: {
        summary: "Restore content in one realm",
        tags: ["Governance", "Realms", "Content"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/content/:targetUnitId/remove",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: realmPolicyActions.queueDecide,
        target: {
          kind: "realm-content",
          id: params.targetUnitId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.setRealmUnitModerationStatus({
        realmUnitId: params.realmUnitId,
        unitId: params.targetUnitId,
        actorUserId: identity.userId,
        action: "remove",
        reasonCode: "realm.content.removed",
        reasonText: body.reason,
        caseId: body.caseId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: unitRealmDTOSchema, 403: t.String() },
      detail: {
        summary: "Remove content from one realm",
        tags: ["Governance", "Realms", "Content"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/content/:targetUnitId/lock",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: contentPolicyActions.lock,
        target: {
          kind: "realm-content",
          id: params.targetUnitId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.setLock({
        targetKind: "UNIT_REALM",
        targetId: params.targetUnitId,
        realmUnitId: params.realmUnitId,
        isLocked: true,
        actorUserId: identity.userId,
        reasonCode: "realm.content.locked",
        reasonText: body.reason,
        caseId: body.caseId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: moderationActionDTOSchema, 403: t.String() },
      detail: {
        summary: "Lock content in one realm",
        tags: ["Governance", "Realms", "Content"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/content/:targetUnitId/unlock",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: contentPolicyActions.lock,
        target: {
          kind: "realm-content",
          id: params.targetUnitId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.setLock({
        targetKind: "UNIT_REALM",
        targetId: params.targetUnitId,
        realmUnitId: params.realmUnitId,
        isLocked: false,
        actorUserId: identity.userId,
        reasonCode: "realm.content.unlocked",
        reasonText: body.reason,
        caseId: body.caseId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: moderationActionDTOSchema, 403: t.String() },
      detail: {
        summary: "Unlock content in one realm",
        tags: ["Governance", "Realms", "Content"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/content/:targetUnitId/owner-delegation",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: realmPolicyActions.queueDecide,
        target: {
          kind: "realm-content-owner-delegation",
          id: params.targetUnitId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.requestOwnerDelegation({
        realmUnitId: params.realmUnitId,
        moderatedUnitId: params.targetUnitId,
        decidedById: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), targetUnitId: t.String() }),
      body: contentModerationDecisionSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Request owner delegation for realm content removal",
        tags: ["Governance", "Realms", "Content"],
      },
    },
  )
  .get(
    "/cases",
    async ({ query, identity, status }) => {
      const denied = await assertStaff(identity, status);
      if (denied) return denied;
      return governanceModerationService.listCases(query);
    },
    {
      requireLogin: true,
      query: listQuerySchema,
      response: { 200: t.Array(moderationCaseDTOSchema), 403: t.String() },
      detail: {
        summary: "List moderation cases",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/cases/:caseId",
    async ({ params, identity, status }) => {
      const denied = await assertStaff(identity, status);
      if (denied) return denied;
      return governanceModerationService.getCase(params.caseId);
    },
    {
      requireLogin: true,
      params: t.Object({ caseId: t.String() }),
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Read a moderation case",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/cases/:caseId/events",
    async ({ params, query, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.caseTriage,
        target: { kind: "moderation-case", id: params.caseId },
      });
      if (denied) return denied;
      return governanceModerationService.listCaseEvents(params.caseId, query);
    },
    {
      requireLogin: true,
      params: t.Object({ caseId: t.String() }),
      query: listQuerySchema,
      response: {
        200: t.Array(moderationActionDTOSchema),
        403: t.String(),
      },
      detail: {
        summary: "List moderation case events",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/cases/from-feedback/:feedbackId",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.caseTriage,
        target: { kind: "feedback", id: params.feedbackId },
      });
      if (denied) return denied;
      return governanceModerationService.createCaseFromFeedback({
        ...body,
        feedbackId: params.feedbackId,
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ feedbackId: t.String() }),
      body: createModerationCaseFromFeedbackSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Create moderation case from report feedback",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/cases/:caseId/duplicate",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.caseTriage,
        target: { kind: "moderation-case", id: params.caseId },
      });
      if (denied) return denied;
      return governanceModerationService.duplicateCase({
        caseId: params.caseId,
        actorUserId: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ caseId: t.String() }),
      body: duplicateModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Mark a moderation case as duplicate",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/cases/:caseId/assign",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.caseAssign,
        target: { kind: "moderation-case", id: params.caseId },
      });
      if (denied) return denied;
      return governanceModerationService.assignCase({
        caseId: params.caseId,
        actorUserId: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ caseId: t.String() }),
      body: assignModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Assign a moderation case",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/cases/:caseId/triage",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.caseTriage,
        target: { kind: "moderation-case", id: params.caseId },
      });
      if (denied) return denied;
      return governanceModerationService.triageCase({
        caseId: params.caseId,
        actorUserId: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ caseId: t.String() }),
      body: triageModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Triage a moderation case",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/cases/:caseId/decision",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.caseDecide,
        target: { kind: "moderation-case", id: params.caseId },
      });
      if (denied) return denied;
      return governanceModerationService.decideCase({
        caseId: params.caseId,
        actorUserId: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ caseId: t.String() }),
      body: decideModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Record a moderation case decision",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/cases/:caseId/appeal",
    async ({ params, body, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.caseReverse,
        target: { kind: "moderation-case", id: params.caseId },
      });
      if (denied) return denied;
      return governanceModerationService.appealCase({
        caseId: params.caseId,
        actorUserId: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ caseId: t.String() }),
      body: appealModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Request moderation case appeal",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/realms/:realmUnitId/cases",
    async ({ params, query, identity, status }) => {
      const denied = await assertStaff(identity, status);
      if (denied) return denied;
      return governanceModerationService.listRealmCases(
        params.realmUnitId,
        query,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String() }),
      query: listQuerySchema,
      response: {
        200: t.Array(moderationCaseDTOSchema),
        403: t.String(),
      },
      detail: {
        summary: "List realm moderation cases",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/cases",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: realmPolicyActions.queueDecide,
        target: {
          kind: "realm-moderation-case",
          id: params.realmUnitId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.createRealmCase({
        realmUnitId: params.realmUnitId,
        actorUserId: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String() }),
      body: createRealmModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Create a realm moderation case",
        tags: ["Governance", "Realms", "Staff"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/cases/from-feedback/:feedbackId",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: realmPolicyActions.queueDecide,
        target: {
          kind: "realm-feedback",
          id: params.feedbackId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.createRealmCaseFromFeedback({
        realmUnitId: params.realmUnitId,
        feedbackId: params.feedbackId,
        actorUserId: identity.userId,
        ...body,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), feedbackId: t.String() }),
      body: createRealmModerationCaseFromFeedbackSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Create a realm moderation case from feedback",
        tags: ["Governance", "Realms", "Staff"],
      },
    },
  )
  .get(
    "/realms/:realmUnitId/cases/:caseId/actions",
    async ({ params, query, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: realmPolicyActions.queueDecide,
        target: {
          kind: "realm-moderation-case",
          id: params.caseId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.listRealmCaseActions(
        params.realmUnitId,
        params.caseId,
        query,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), caseId: t.String() }),
      query: listQuerySchema,
      response: {
        200: t.Array(moderationActionDTOSchema),
        403: t.String(),
      },
      detail: {
        summary: "List realm moderation case actions",
        tags: ["Governance", "Realms", "Staff"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/cases/:caseId/decision",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action:
          body.actionKind === "escalate"
            ? realmPolicyActions.reportEscalate
            : realmPolicyActions.queueDecide,
        target: {
          kind: "realm-moderation-case",
          id: params.caseId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.decideRealmCase({
        realmUnitId: params.realmUnitId,
        caseId: params.caseId,
        actorUserId: identity.userId,
        decisionKind: realmCaseDecisionKind(body.actionKind) as never,
        reason: body.reason,
        duplicateOfCaseId: body.duplicateOfCaseId,
        parentCaseId: body.parentCaseId,
        decision: body.decision,
        metadata: body.metadata,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), caseId: t.String() }),
      body: decideRealmModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Decide a realm moderation case",
        tags: ["Governance", "Realms", "Staff"],
      },
    },
  )
  .post(
    "/realms/:realmUnitId/cases/:caseId/escalate",
    async ({ params, body, identity, status }) => {
      const denied = await assertRealmGovernancePolicy({
        identity,
        status,
        realmUnitId: params.realmUnitId,
        action: realmPolicyActions.reportEscalate,
        target: {
          kind: "realm-moderation-case",
          id: params.caseId,
          realmUnitId: params.realmUnitId,
        },
      });
      if (denied) return denied;
      return governanceModerationService.escalateRealmCase({
        realmUnitId: params.realmUnitId,
        caseId: params.caseId,
        actorUserId: identity.userId,
        reason: body.reason,
        platformCaseId: body.caseId,
        safeSummary: body.safeSummary,
      });
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String(), caseId: t.String() }),
      body: escalateRealmModerationCaseSchema,
      response: { 200: moderationCaseDTOSchema, 403: t.String() },
      detail: {
        summary: "Escalate a realm moderation case to site staff",
        tags: ["Governance", "Realms", "Staff"],
      },
    },
  )
  .get(
    "/audit",
    async ({ query, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: { kind: "staff-audit-log", id: "list" },
      });
      if (denied) return denied;
      return governanceAuditService.list(query);
    },
    {
      requireLogin: true,
      query: auditListQuerySchema,
      response: { 200: t.Array(staffAuditLogDTOSchema), 403: t.String() },
      detail: {
        summary: "List staff audit records",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/audit/:auditLogId",
    async ({ params, identity, status }) => {
      const denied = await assertGovernancePolicy({
        identity,
        status,
        action: sitePolicyActions.auditRead,
        target: { kind: "staff-audit-log", id: params.auditLogId },
      });
      if (denied) return denied;

      const auditLog = await governanceAuditService.get(params.auditLogId);
      return auditLog ?? status(404, "Audit log not found");
    },
    {
      requireLogin: true,
      params: t.Object({ auditLogId: t.String() }),
      response: {
        200: staffAuditLogDTOSchema,
        403: t.String(),
        404: t.String(),
      },
      detail: {
        summary: "Read a staff audit record",
        tags: ["Governance", "Staff"],
      },
    },
  );

export type GovernanceApi = typeof governanceApi;
