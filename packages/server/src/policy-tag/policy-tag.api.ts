import {
  createPolicyTagApplicationSchema,
  createPolicyTagRuleSchema,
  type PolicyTagApplicationDTO,
  type PolicyTagApplicationListResponse,
  type PolicyTagRuleDTO,
  type PolicyTagRuleListResponse,
  patchPolicyTagApplicationSchema,
  policyTagApplicationDTOSchema,
  policyTagApplicationListQuerySchema,
  policyTagApplicationListResponseSchema,
  policyTagApplicationPathParamsSchema,
  policyTagRuleDTOSchema,
  policyTagRuleListQuerySchema,
  policyTagRuleListResponseSchema,
  policyTagRulePathParamsSchema,
  updatePolicyTagRuleSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { realmService } from "@/realm/realm.service";
import {
  mapPolicyTagApplicationToDTO,
  mapPolicyTagRuleToDTO,
} from "./policy-tag.mapper";
import { PolicyTagError, policyTagService } from "./policy-tag.service";

function handlePolicyTagError(error: unknown): never {
  if (error instanceof PolicyTagError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

async function realmMembershipForPolicy(realmUnitId: string, userId: string) {
  const member = await realmService.getMember(realmUnitId, userId);
  return member
    ? {
        realmUnitId: member.realmUnitId,
        role: member.roleKey as never,
        capabilities: member.capabilities ?? [],
      }
    : null;
}

async function assertPolicyTagAction(input: {
  identity: any;
  action:
    | typeof realmPolicyActions.tagPolicyRuleManage
    | typeof realmPolicyActions.tagPolicyApplicationManage;
  targetKind: "policy-tag-rule" | "policy-tag-application";
  targetId: string;
  realmUnitId?: string | null;
}) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: input.action,
    realmMembership: input.realmUnitId
      ? await realmMembershipForPolicy(input.realmUnitId, input.identity.userId)
      : null,
    target: {
      kind: input.targetKind,
      id: input.targetId,
      ...(input.realmUnitId ? { realmUnitId: input.realmUnitId } : {}),
    },
  });
  if (!decision.allowed) {
    throw status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this action",
    );
  }
}

function realmUnitIdFromRule(
  rule: Awaited<ReturnType<typeof policyTagService.getRule>>,
) {
  return rule.scopeKind === "realm" ? rule.realmUnitId : null;
}

export const policyTagApi = new Elysia({ prefix: "/policy-tag" })
  .use(authMacro)
  .get(
    "/rules",
    async ({ query }): Promise<PolicyTagRuleListResponse> => {
      const result = await policyTagService.listRules(query);
      return {
        rules: result.rows.map(mapPolicyTagRuleToDTO),
        total: result.total,
      };
    },
    {
      query: policyTagRuleListQuerySchema,
      response: policyTagRuleListResponseSchema,
      detail: {
        summary: "List policy tag rules",
        tags: ["Policy Tags"],
      },
    },
  )
  .post(
    "/rules",
    async ({ body, identity }): Promise<PolicyTagRuleDTO> => {
      await assertPolicyTagAction({
        identity,
        action: realmPolicyActions.tagPolicyRuleManage,
        targetKind: "policy-tag-rule",
        targetId: `${body.scope.kind}:${body.tagUnitId}`,
        realmUnitId:
          body.scope.kind === "realm" ? body.scope.realmUnitId : null,
      });
      try {
        return mapPolicyTagRuleToDTO(
          await policyTagService.createRule(identity.userId, body),
        );
      } catch (error) {
        handlePolicyTagError(error);
      }
    },
    {
      requireLogin: true,
      body: createPolicyTagRuleSchema,
      response: policyTagRuleDTOSchema,
      detail: {
        summary: "Create a policy tag rule",
        tags: ["Policy Tags"],
      },
    },
  )
  .patch(
    "/rules/:ruleId",
    async ({ params, body, identity }): Promise<PolicyTagRuleDTO> => {
      const rule = await policyTagService.getRule(params.ruleId);
      await assertPolicyTagAction({
        identity,
        action: realmPolicyActions.tagPolicyRuleManage,
        targetKind: "policy-tag-rule",
        targetId: params.ruleId,
        realmUnitId: realmUnitIdFromRule(rule),
      });
      try {
        return mapPolicyTagRuleToDTO(
          await policyTagService.updateRule(
            identity.userId,
            params.ruleId,
            body,
          ),
        );
      } catch (error) {
        handlePolicyTagError(error);
      }
    },
    {
      requireLogin: true,
      params: policyTagRulePathParamsSchema,
      body: updatePolicyTagRuleSchema,
      response: policyTagRuleDTOSchema,
      detail: {
        summary: "Update a policy tag rule",
        tags: ["Policy Tags"],
      },
    },
  )
  .get(
    "/applications",
    async ({ query }): Promise<PolicyTagApplicationListResponse> => {
      const result = await policyTagService.listApplications(query);
      return {
        applications: result.rows.map(mapPolicyTagApplicationToDTO),
        total: result.total,
      };
    },
    {
      query: policyTagApplicationListQuerySchema,
      response: policyTagApplicationListResponseSchema,
      detail: {
        summary: "List policy tag applications",
        tags: ["Policy Tags"],
      },
    },
  )
  .post(
    "/rules/:ruleId/applications",
    async ({ params, body, identity }): Promise<PolicyTagApplicationDTO> => {
      const rule = await policyTagService.getRule(params.ruleId);
      await assertPolicyTagAction({
        identity,
        action: realmPolicyActions.tagPolicyApplicationManage,
        targetKind: "policy-tag-application",
        targetId: `${params.ruleId}:${body.unitId}`,
        realmUnitId: realmUnitIdFromRule(rule),
      });
      try {
        return mapPolicyTagApplicationToDTO(
          await policyTagService.upsertApplication(
            identity.userId,
            params.ruleId,
            body,
          ),
        );
      } catch (error) {
        handlePolicyTagError(error);
      }
    },
    {
      requireLogin: true,
      params: policyTagRulePathParamsSchema,
      body: createPolicyTagApplicationSchema,
      response: policyTagApplicationDTOSchema,
      detail: {
        summary: "Create or update a policy tag application",
        tags: ["Policy Tags"],
      },
    },
  )
  .patch(
    "/rules/:ruleId/applications/:unitId",
    async ({ params, body, identity }): Promise<PolicyTagApplicationDTO> => {
      const rule = await policyTagService.getRule(params.ruleId);
      await assertPolicyTagAction({
        identity,
        action: realmPolicyActions.tagPolicyApplicationManage,
        targetKind: "policy-tag-application",
        targetId: `${params.ruleId}:${params.unitId}`,
        realmUnitId: realmUnitIdFromRule(rule),
      });
      try {
        return mapPolicyTagApplicationToDTO(
          await policyTagService.patchApplication(
            identity.userId,
            params.ruleId,
            params.unitId,
            body,
          ),
        );
      } catch (error) {
        handlePolicyTagError(error);
      }
    },
    {
      requireLogin: true,
      params: policyTagApplicationPathParamsSchema,
      body: patchPolicyTagApplicationSchema,
      response: policyTagApplicationDTOSchema,
      detail: {
        summary: "Patch a policy tag application",
        tags: ["Policy Tags"],
      },
    },
  )
  .delete(
    "/rules/:ruleId/applications/:unitId",
    async ({ params, identity }): Promise<{ ok: true }> => {
      const rule = await policyTagService.getRule(params.ruleId);
      await assertPolicyTagAction({
        identity,
        action: realmPolicyActions.tagPolicyApplicationManage,
        targetKind: "policy-tag-application",
        targetId: `${params.ruleId}:${params.unitId}`,
        realmUnitId: realmUnitIdFromRule(rule),
      });
      try {
        await policyTagService.deleteApplication(params.ruleId, params.unitId);
        return { ok: true };
      } catch (error) {
        handlePolicyTagError(error);
      }
    },
    {
      requireLogin: true,
      params: policyTagApplicationPathParamsSchema,
      detail: {
        summary: "Delete a policy tag application",
        tags: ["Policy Tags"],
      },
    },
  );
