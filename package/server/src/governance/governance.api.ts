import {
  activeAccountEnforcementSummarySchema,
  accountEnforcementDTOSchema,
  capabilityHintSchema,
  createAccountEnforcementSchema,
  moderationCaseDTOSchema,
  policyDecisionSchema,
  policyInputSchema,
  realmModerationQueueItemDTOSchema,
  staffAuditLogDTOSchema,
  unblockAccountEnforcementSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { accountPolicyActions } from "./action/account";
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

export const governanceApi = new Elysia({ prefix: "/governance" })
  .use(authMacro)
  .get(
    "/capability-hints/me",
    async ({ identity }) => ({
      capabilities: await governanceCapabilityService.resolveForUser(
        identity.userId,
      ),
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
    "/realms/:realmUnitId/queue",
    async ({ params, query, identity, status }) => {
      const denied = await assertStaff(identity, status);
      if (denied) return denied;
      return governanceModerationService.listRealmQueue(
        params.realmUnitId,
        query,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ realmUnitId: t.String() }),
      query: listQuerySchema,
      response: {
        200: t.Array(realmModerationQueueItemDTOSchema),
        403: t.String(),
      },
      detail: {
        summary: "List realm moderation queue items",
        tags: ["Governance", "Staff"],
      },
    },
  )
  .get(
    "/audit",
    async ({ query, identity, status }) => {
      const denied = await assertStaff(identity, status);
      if (denied) return denied;
      return governanceAuditService.list(query);
    },
    {
      requireLogin: true,
      query: listQuerySchema,
      response: { 200: t.Array(staffAuditLogDTOSchema), 403: t.String() },
      detail: {
        summary: "List staff audit records",
        tags: ["Governance", "Staff"],
      },
    },
  );

export type GovernanceApi = typeof governanceApi;
