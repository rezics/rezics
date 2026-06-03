import type {
  AccountEnforcementDTO,
  AccountEnforcementKind,
  AccountEnforcementState,
  CapabilityGrantDTO,
  ModerationActionDTO,
  ModerationActionKind,
  ModerationActorKind,
  ModerationAuthority,
  ModerationCaseDTO,
  ModerationCaseState,
  ModerationScope,
  ModerationStatus,
  ModerationTargetKind,
  StaffAuditLogDTO,
} from "@rezics/contract";
import type {
  AccountEnforcementRow,
  ModerationActionRow,
  ModerationCaseRow,
  RealmCapabilityGrantRow,
  StaffAuditLogRow,
  StaffGrantRow,
} from "./types";

function lower<T extends string>(value: string): T {
  return value.toLowerCase() as T;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function mapStaffGrantToCapabilityDTO(
  row: StaffGrantRow,
): CapabilityGrantDTO {
  return {
    id: row.id,
    userId: row.userId,
    capability: row.capability as CapabilityGrantDTO["capability"],
    scope: {
      kind: row.scopeKind as CapabilityGrantDTO["scope"]["kind"],
      ...(row.realmUnitId ? { realmUnitId: row.realmUnitId } : {}),
    },
    state: lower(row.state),
    grantedByUserId: row.grantedById,
    revokedByUserId: row.revokedById,
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapRealmGrantToCapabilityDTO(
  row: RealmCapabilityGrantRow,
): CapabilityGrantDTO {
  return {
    id: row.id,
    userId: row.userId,
    capability: row.capability as CapabilityGrantDTO["capability"],
    scope: { kind: "realm", realmUnitId: row.realmUnitId },
    state: lower(row.state),
    grantedByUserId: row.grantedById,
    revokedByUserId: row.revokedById,
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAccountEnforcementToDTO(
  row: AccountEnforcementRow,
): AccountEnforcementDTO {
  return {
    id: row.id,
    targetUserId: row.targetUserId,
    kind: lower<AccountEnforcementKind>(row.kind),
    state: lower<AccountEnforcementState>(row.state),
    reason: row.reason,
    safeMessage: row.safeMessage,
    decidedByUserId: row.decidedById,
    decisionCode: row.decisionCode as AccountEnforcementDTO["decisionCode"],
    startsAt: row.startsAt.toISOString(),
    expiresAt: iso(row.expiresAt),
    revokedAt: iso(row.revokedAt),
    decisionActionId: row.decisionActionId,
    revocationActionId: row.revocationActionId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapModerationCaseToDTO(
  row: ModerationCaseRow,
): ModerationCaseDTO {
  return {
    id: row.id,
    scope: lower<ModerationScope>(row.scope),
    state: lower<ModerationCaseState>(row.state),
    severity: row.severity,
    reporterUserId: row.reporterUserId,
    subjectUserId: row.subjectUserId,
    target: {
      kind: lower<ModerationTargetKind>(row.targetKind),
      id: row.targetId,
      realmUnitId: row.realmUnitId,
    },
    sourceFeedbackId: row.sourceFeedbackId,
    assignedToUserId: row.assignedToUserId,
    parentCaseId: row.parentCaseId,
    duplicateOfCaseId: row.duplicateOfCaseId,
    reason: row.reason,
    safeSummary: row.safeSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapModerationActionToDTO(
  row: ModerationActionRow,
): ModerationActionDTO {
  return {
    id: row.id,
    authority: lower<ModerationAuthority>(row.authority),
    realmUnitId: row.realmUnitId,
    targetKind: lower<ModerationTargetKind>(row.targetKind),
    targetId: row.targetId,
    targetPath: row.targetPath,
    actorKind: lower<ModerationActorKind>(row.actorKind),
    actorUserId: row.actorUserId,
    actionKind: lower<ModerationActionKind>(row.actionKind),
    resultingStatus: row.resultingStatus
      ? lower<ModerationStatus>(row.resultingStatus)
      : null,
    resultingLocked: row.resultingLocked,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    publicMessage: row.publicMessage,
    caseId: row.caseId,
    reversesActionId: row.reversesActionId,
    requestId: row.requestId,
    importedFrom: row.importedFrom,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapStaffAuditLogToDTO(row: StaffAuditLogRow): StaffAuditLogDTO {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    targetKind: row.targetKind,
    targetId: row.targetId,
    decisionCode: row.decisionCode as StaffAuditLogDTO["decisionCode"],
    requestId: row.requestId,
    reason: row.reason,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
