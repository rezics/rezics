import type {
  AccountEnforcementDTO,
  AccountEnforcementKind,
  AccountEnforcementState,
  CapabilityGrantDTO,
  ContentModerationStateDTO,
  ContentModerationStateKind,
  ModerationCaseDTO,
  ModerationCaseEventDTO,
  ModerationCaseState,
  RealmModerationEventDTO,
  RealmModerationQueueItemDTO,
  RealmContentModerationDTO,
  StaffAuditLogDTO,
} from "@rezics/contract";
import type {
  AccountEnforcementRow,
  ContentModerationStateRow,
  ModerationCaseEventRow,
  ModerationCaseRow,
  RealmCapabilityGrantRow,
  RealmContentModerationRow,
  RealmModerationEventRow,
  RealmModerationQueueItemRow,
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
    auditLogId: row.auditLogId,
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
    state: lower<ModerationCaseState>(row.state),
    severity: row.severity,
    reporterUserId: row.reporterUserId,
    subjectUserId: row.subjectUserId,
    target: {
      kind: row.targetKind,
      id: row.targetId,
      realmUnitId: row.realmUnitId,
    },
    sourceFeedbackId: row.sourceFeedbackId,
    assignedToUserId: row.assignedToUserId,
    duplicateOfCaseId: row.duplicateOfCaseId,
    reason: row.reason,
    safeSummary: row.safeSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapModerationCaseEventToDTO(
  row: ModerationCaseEventRow,
): ModerationCaseEventDTO {
  return {
    id: row.id,
    caseId: row.caseId,
    actorUserId: row.actorUserId,
    eventType: row.eventType,
    decision: row.decision as ModerationCaseEventDTO["decision"],
    reason: row.reason,
    before: (row.before as Record<string, unknown> | null) ?? undefined,
    after: (row.after as Record<string, unknown> | null) ?? undefined,
    reversible: row.reversible,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapRealmQueueItemToDTO(
  row: RealmModerationQueueItemRow,
): RealmModerationQueueItemDTO {
  return {
    id: row.id,
    realmUnitId: row.realmUnitId,
    state: lower(row.state),
    reporterUserId: row.reporterUserId,
    subjectUserId: row.subjectUserId,
    target: {
      kind: row.targetKind,
      id: row.targetId,
      realmUnitId: row.realmUnitId,
    },
    sourceFeedbackId: row.sourceFeedbackId,
    linkedCaseId: row.linkedCaseId,
    assignedToUserId: row.assignedToUserId,
    reason: row.reason,
    safeSummary: row.safeSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapRealmModerationEventToDTO(
  row: RealmModerationEventRow,
): RealmModerationEventDTO {
  return {
    id: row.id,
    queueItemId: row.queueItemId,
    realmUnitId: row.realmUnitId,
    actorUserId: row.actorUserId,
    decisionKind: row.decisionKind as RealmModerationEventDTO["decisionKind"],
    decision: row.decision as RealmModerationEventDTO["decision"],
    reason: row.reason,
    before: (row.before as Record<string, unknown> | null) ?? undefined,
    after: (row.after as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapContentModerationStateToDTO(
  row: ContentModerationStateRow,
): ContentModerationStateDTO {
  return {
    targetUnitId: row.targetUnitId,
    state: lower<ContentModerationStateKind>(row.state),
    decidedByUserId: row.decidedById,
    caseId: row.caseId,
    reason: row.reason,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapRealmContentModerationToDTO(
  row: RealmContentModerationRow,
): RealmContentModerationDTO {
  return {
    realmUnitId: row.realmUnitId,
    targetUnitId: row.targetUnitId,
    state: lower<ContentModerationStateKind>(row.state),
    decidedByUserId: row.decidedById,
    caseId: row.caseId,
    reason: row.reason,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
    before: (row.before as Record<string, unknown> | null) ?? undefined,
    after: (row.after as Record<string, unknown> | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
