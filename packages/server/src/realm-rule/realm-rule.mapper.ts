import type {
  RealmRuleAcknowledgementDTO,
  RealmRuleItemDTO,
  RealmRulePolicyDTO,
  RealmRuleRevisionDTO,
} from "@rezics/contract";
import type {
  RealmRuleAcknowledgement,
  RealmRuleItem,
  RealmRulePolicy,
  RealmRuleRevision,
} from "../db/schema";

type PolicyRow = typeof RealmRulePolicy.$inferSelect;
type RevisionRow = typeof RealmRuleRevision.$inferSelect;
type ItemRow = typeof RealmRuleItem.$inferSelect;
type AckRow = typeof RealmRuleAcknowledgement.$inferSelect;

export const emptyRealmRuleRequirements = {
  requireOnJoin: false,
  requireOnPost: false,
  requireOnUpdate: true,
} as const;

export function mapRealmRulePolicyToDTO(
  realmUnitId: string,
  policy: PolicyRow | null,
  currentRevision?: Pick<RevisionRow, "id" | "version"> | null,
): RealmRulePolicyDTO {
  return {
    realmUnitId,
    policyId: policy?.id ?? null,
    currentRevisionId: currentRevision?.id ?? policy?.currentRevisionId ?? null,
    currentVersion: currentRevision?.version ?? null,
    requirements: policy
      ? {
          requireOnJoin: policy.requireOnJoin,
          requireOnPost: policy.requireOnPost,
          requireOnUpdate: policy.requireOnUpdate,
        }
      : { ...emptyRealmRuleRequirements },
    updatedAt: policy?.updatedAt,
  };
}

export function mapRealmRuleItemToDTO(row: ItemRow): RealmRuleItemDTO {
  return {
    id: row.id,
    policyId: row.policyId,
    revisionId: row.revisionId,
    rulePostUnitId: row.rulePostUnitId,
    position: row.position,
    appliesTo: row.appliesTo ?? null,
    reportReasonUnitId: row.reportReasonUnitId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapRealmRuleRevisionToDTO(
  row: RevisionRow,
  items: ItemRow[],
): RealmRuleRevisionDTO {
  return {
    id: row.id,
    policyId: row.policyId,
    version: row.version,
    items: items.map(mapRealmRuleItemToDTO),
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt,
  };
}

export function mapRealmRuleAcknowledgementToDTO(
  row: AckRow,
): RealmRuleAcknowledgementDTO {
  return {
    realmUnitId: row.realmUnitId,
    policyId: row.policyId,
    revisionId: row.revisionId,
    version: row.version,
    userId: row.userId,
    acceptedAt: row.acceptedAt,
    acceptedLanguage: row.acceptedLanguage ?? null,
  };
}
