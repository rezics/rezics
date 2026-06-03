import type {
  AccountEnforcement,
  ModerationCase,
  ModerationAction,
  RealmCapabilityGrant,
  StaffAuditLog,
  StaffGrant,
} from "#/prisma/client";

export type StaffGrantRow = StaffGrant;
export type RealmCapabilityGrantRow = RealmCapabilityGrant;
export type AccountEnforcementRow = AccountEnforcement;
export type ModerationCaseRow = ModerationCase;
export type ModerationActionRow = ModerationAction;
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
