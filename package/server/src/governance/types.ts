import type {
  AccountEnforcement,
  ContentModerationState,
  ModerationCase,
  ModerationCaseEvent,
  RealmCapabilityGrant,
  RealmModerationEvent,
  RealmModerationQueueItem,
  StaffAuditLog,
  StaffGrant,
} from "#/prisma/client";

export type StaffGrantRow = StaffGrant;
export type RealmCapabilityGrantRow = RealmCapabilityGrant;
export type AccountEnforcementRow = AccountEnforcement;
export type ContentModerationStateRow = ContentModerationState;
export type ModerationCaseRow = ModerationCase;
export type ModerationCaseEventRow = ModerationCaseEvent;
export type RealmModerationQueueItemRow = RealmModerationQueueItem;
export type RealmModerationEventRow = RealmModerationEvent;
export type StaffAuditLogRow = StaffAuditLog;

export type GovernanceListOptions = {
  offset?: number;
  limit?: number;
};

export type GovernanceAuditListOptions = GovernanceListOptions & {
  actorUserId?: string;
  action?: string;
  targetKind?: string;
  targetId?: string;
  decisionCode?: string;
  requestId?: string;
};
