import type {
  PolicyTagApplicationDTO,
  PolicyTagAuthority,
  PolicyTagRuleDTO,
  PolicyTagScope,
} from "@rezics/contract";
import type { PolicyTagApplication, PolicyTagRule } from "../db/schema";

type PolicyTagRuleRow = typeof PolicyTagRule.$inferSelect;
type PolicyTagApplicationRow = typeof PolicyTagApplication.$inferSelect;

export type PolicyTagApplicationWithRule = PolicyTagApplicationRow & {
  rule: PolicyTagRuleRow;
};

const POLICY_TAG_AUTHORITY: PolicyTagAuthority = {
  ruleManageAction: "tag.policy.rule.manage",
  applicationManageAction: "tag.policy.application.manage",
  requiredCapability: "tag.curate",
};

function mapScope(row: Pick<PolicyTagRuleRow, "scopeKind" | "realmUnitId">) {
  if (row.scopeKind === "realm") {
    if (!row.realmUnitId) {
      throw new Error("Policy tag realm scope requires realmUnitId");
    }
    return {
      kind: "realm",
      realmUnitId: row.realmUnitId,
    } satisfies PolicyTagScope;
  }
  return { kind: "global" } satisfies PolicyTagScope;
}

function mapRuleState(state: PolicyTagRuleRow["state"]) {
  return state === "ARCHIVED" ? "archived" : "active";
}

export function mapPolicyTagRuleToDTO(row: PolicyTagRuleRow): PolicyTagRuleDTO {
  return {
    id: row.id,
    scope: mapScope(row),
    tagUnitId: row.tagUnitId,
    state: mapRuleState(row.state),
    authority: POLICY_TAG_AUTHORITY,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId ?? null,
    reason: row.reason ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapPolicyTagApplicationToDTO(
  row: PolicyTagApplicationWithRule,
): PolicyTagApplicationDTO {
  return {
    id: row.id,
    ruleId: row.ruleId,
    scope: mapScope(row.rule),
    tagUnitId: row.rule.tagUnitId,
    unitId: row.unitId,
    position: row.position ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    appliedByUserId: row.appliedByUserId,
    updatedByUserId: row.updatedByUserId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
