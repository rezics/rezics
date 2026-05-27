import type {
  AccountEnforcement,
  ContentModerationState,
  ModerationCase,
  ModerationCaseEvent,
  RealmCapabilityGrant,
  RealmContentModeration,
  RealmModerationEvent,
  RealmModerationQueueItem,
  StaffAuditLog,
  StaffGrant,
} from "#/prisma/client";

export type StaffGrantRow = StaffGrant;
export type RealmCapabilityGrantRow = RealmCapabilityGrant;
export type AccountEnforcementRow = AccountEnforcement;
export type ContentModerationStateRow = ContentModerationState;
export type RealmContentModerationRow = RealmContentModeration;
export type ModerationCaseRow = ModerationCase;
export type ModerationCaseEventRow = ModerationCaseEvent;
export type RealmModerationQueueItemRow = RealmModerationQueueItem;
export type RealmModerationEventRow = RealmModerationEvent;
export type StaffAuditLogRow = StaffAuditLog;

export type GovernanceListOptions = {
  offset?: number;
  limit?: number;
};
