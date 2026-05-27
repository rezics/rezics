import type {
  AdminWorkMergeMembershipMove,
  AdminWorkMergeOperation,
} from "@rezics/contract";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asMembershipMoves(value: unknown): AdminWorkMergeMembershipMove[] {
  return Array.isArray(value) ? (value as AdminWorkMergeMembershipMove[]) : [];
}

export function mapAdminWorkMergeOperation(row: any): AdminWorkMergeOperation {
  return {
    id: row.id,
    sourceWorkUnitId: row.sourceWorkUnitId,
    targetWorkUnitId: row.targetWorkUnitId,
    status: row.status,
    actorUserId: row.actorUserId,
    reason: row.reason,
    copyTagsRequested: row.copyTagsRequested,
    copyAliasesRequested: row.copyAliasesRequested,
    itemProgress: asRecord(row.itemProgress),
    movedMemberships: asMembershipMoves(row.movedMemberships),
    movedLegacyReleaseUnitIds: row.movedLegacyReleaseUnitIds ?? [],
    createdTagKeys: row.createdTagKeys ?? [],
    createdAliasIds: row.createdAliasIds ?? [],
    repairUnitIds: row.repairUnitIds ?? [],
    repairCommandCount: row.repairCommandCount ?? 0,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    revertedAt: row.revertedAt,
    revertedByUserId: row.revertedByUserId,
  };
}
