import {
  activeAccountEnforcementSummarySchema,
  accountEnforcementDTOSchema,
  capabilityHintSchema,
  moderationCaseDTOSchema,
  policyDecisionSchema,
  policyInputSchema,
  realmModerationQueueItemDTOSchema,
  staffAuditLogDTOSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { governanceAuditService } from "./audit.service";
import { governanceCapabilityService } from "./capability.service";
import { governanceEnforcementService } from "./enforcement.service";
import { governanceModerationService } from "./moderation.service";
import { decide } from "./policy";

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
      const denied = await assertStaff(identity, status);
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
      const denied = await assertStaff(identity, status);
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
