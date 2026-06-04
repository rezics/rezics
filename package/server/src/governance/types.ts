import type {
  AccountEnforcement,
  ModerationCase,
  ModerationAction,
  RealmCapabilityGrant,
  StaffAuditLog,
  StaffGrant,
} from "../db/schema";

export type StaffGrantRow = typeof StaffGrant.$inferSelect;
export type RealmCapabilityGrantRow = typeof RealmCapabilityGrant.$inferSelect;
export type AccountEnforcementRow = typeof AccountEnforcement.$inferSelect;
export type ModerationCaseRow = typeof ModerationCase.$inferSelect;
export type ModerationActionRow = typeof ModerationAction.$inferSelect;
export type StaffAuditLogRow = typeof StaffAuditLog.$inferSelect;

export type GovernanceListOptions = {
  offset?: number;
  limit?: number;
  scope?: string;
  state?: string;
};

export type GovernanceAuditListOptions = GovernanceListOptions & {
  actorUserId?: string;
  action?: string;
  targetKind?: string;
  targetId?: string;
  decisionCode?: string;
  requestId?: string;
};
