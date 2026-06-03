import { t } from "elysia";
import {
  capabilitySchema,
  capabilityScopeSchema,
} from "../permission/capability";
import { decisionCodeSchema, decisionSchema } from "../permission/decision";

export const auditMetadataSchema = t.Record(t.String(), t.Unknown());

export const accountEnforcementKinds = [
  "warning",
  "silence",
  "suspension",
  "ban",
  "rate_limit",
  "trust_restriction",
] as const;

export type AccountEnforcementKind = (typeof accountEnforcementKinds)[number];

export const accountEnforcementKindSchema = t.Union([
  t.Literal("warning"),
  t.Literal("silence"),
  t.Literal("suspension"),
  t.Literal("ban"),
  t.Literal("rate_limit"),
  t.Literal("trust_restriction"),
]);

export const accountEnforcementStateSchema = t.Union([
  t.Literal("active"),
  t.Literal("expired"),
  t.Literal("revoked"),
]);

export type AccountEnforcementState =
  (typeof accountEnforcementStateSchema)["static"];

export const accountEnforcementDTOSchema = t.Object({
  id: t.String(),
  targetUserId: t.String(),
  kind: accountEnforcementKindSchema,
  state: accountEnforcementStateSchema,
  reason: t.String(),
  safeMessage: t.Optional(t.Nullable(t.String())),
  decidedByUserId: t.String(),
  decisionCode: decisionCodeSchema,
  startsAt: t.String(),
  expiresAt: t.Optional(t.Nullable(t.String())),
  revokedAt: t.Optional(t.Nullable(t.String())),
  auditLogId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(auditMetadataSchema),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type AccountEnforcementDTO =
  (typeof accountEnforcementDTOSchema)["static"];

export const createAccountEnforcementSchema = t.Object({
  kind: accountEnforcementKindSchema,
  reason: t.String({ minLength: 1 }),
  safeMessage: t.Optional(t.Nullable(t.String())),
  expiresAt: t.Optional(t.Nullable(t.String())),
  caseId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(auditMetadataSchema),
});

export type CreateAccountEnforcementInput =
  (typeof createAccountEnforcementSchema)["static"];

export const unblockAccountEnforcementSchema = t.Object({
  reason: t.String({ minLength: 1 }),
  safeMessage: t.Optional(t.Nullable(t.String())),
  caseId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(auditMetadataSchema),
});

export type UnblockAccountEnforcementInput =
  (typeof unblockAccountEnforcementSchema)["static"];

export const activeAccountEnforcementSummarySchema = t.Object({
  targetUserId: t.String(),
  activeKinds: t.Array(accountEnforcementKindSchema),
  strongestKind: t.Optional(t.Nullable(accountEnforcementKindSchema)),
  expiresAt: t.Optional(t.Nullable(t.String())),
});

export type ActiveAccountEnforcementSummary =
  (typeof activeAccountEnforcementSummarySchema)["static"];

export const capabilityGrantStateSchema = t.Union([
  t.Literal("active"),
  t.Literal("expired"),
  t.Literal("revoked"),
]);

export const capabilityGrantDTOSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  capability: capabilitySchema,
  scope: capabilityScopeSchema,
  state: capabilityGrantStateSchema,
  grantedByUserId: t.String(),
  revokedByUserId: t.Optional(t.Nullable(t.String())),
  expiresAt: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type CapabilityGrantDTO = (typeof capabilityGrantDTOSchema)["static"];

export const grantCapabilitySchema = t.Object({
  capability: capabilitySchema,
  expiresAt: t.Optional(t.Nullable(t.String())),
});

export type GrantCapabilityInput = (typeof grantCapabilitySchema)["static"];

export const moderationCaseStates = [
  "new",
  "triaged",
  "assigned",
  "actioned",
  "resolved",
  "duplicate",
  "rejected",
  "escalated",
] as const;

export const moderationCaseStateSchema = t.Union([
  t.Literal("new"),
  t.Literal("triaged"),
  t.Literal("assigned"),
  t.Literal("actioned"),
  t.Literal("resolved"),
  t.Literal("duplicate"),
  t.Literal("rejected"),
  t.Literal("escalated"),
]);

export type ModerationCaseState = (typeof moderationCaseStateSchema)["static"];

export const moderationTargetRefSchema = t.Object({
  kind: t.String(),
  id: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
});

export type ModerationTargetRef = (typeof moderationTargetRefSchema)["static"];

export const moderationCaseDTOSchema = t.Object({
  id: t.String(),
  state: moderationCaseStateSchema,
  severity: t.Optional(t.Nullable(t.String())),
  reporterUserId: t.Optional(t.Nullable(t.String())),
  subjectUserId: t.Optional(t.Nullable(t.String())),
  target: moderationTargetRefSchema,
  sourceFeedbackId: t.Optional(t.Nullable(t.String())),
  assignedToUserId: t.Optional(t.Nullable(t.String())),
  duplicateOfCaseId: t.Optional(t.Nullable(t.String())),
  reason: t.Optional(t.Nullable(t.String())),
  safeSummary: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type ModerationCaseDTO = (typeof moderationCaseDTOSchema)["static"];

export const moderationCaseEventDTOSchema = t.Object({
  id: t.String(),
  caseId: t.String(),
  actorUserId: t.String(),
  eventType: t.String(),
  decision: t.Optional(t.Nullable(decisionSchema)),
  reason: t.Optional(t.Nullable(t.String())),
  before: t.Optional(auditMetadataSchema),
  after: t.Optional(auditMetadataSchema),
  reversible: t.Optional(t.Boolean()),
  createdAt: t.String(),
});

export type ModerationCaseEventDTO =
  (typeof moderationCaseEventDTOSchema)["static"];

export const createModerationCaseFromFeedbackSchema = t.Object(
  {
    severity: t.Optional(t.Nullable(t.String())),
    reason: t.Optional(t.Nullable(t.String())),
    safeSummary: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(auditMetadataSchema),
  },
  { additionalProperties: false },
);

export type CreateModerationCaseFromFeedbackInput =
  (typeof createModerationCaseFromFeedbackSchema)["static"];

export const duplicateModerationCaseSchema = t.Object(
  {
    duplicateOfCaseId: t.String(),
    reason: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type DuplicateModerationCaseInput =
  (typeof duplicateModerationCaseSchema)["static"];

export const assignModerationCaseSchema = t.Object(
  {
    assignedToUserId: t.Nullable(t.String()),
    reason: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type AssignModerationCaseInput =
  (typeof assignModerationCaseSchema)["static"];

export const triageModerationCaseSchema = t.Object(
  {
    severity: t.Optional(t.Nullable(t.String())),
    assignedToUserId: t.Optional(t.Nullable(t.String())),
    reason: t.Optional(t.Nullable(t.String())),
    safeSummary: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type TriageModerationCaseInput =
  (typeof triageModerationCaseSchema)["static"];

export const decideModerationCaseSchema = t.Object(
  {
    state: t.Union([
      t.Literal("actioned"),
      t.Literal("resolved"),
      t.Literal("rejected"),
    ]),
    reason: t.String({ minLength: 1 }),
    decision: t.Optional(decisionSchema),
  },
  { additionalProperties: false },
);

export type DecideModerationCaseInput =
  (typeof decideModerationCaseSchema)["static"];

export const appealModerationCaseSchema = t.Object(
  {
    reason: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type AppealModerationCaseInput =
  (typeof appealModerationCaseSchema)["static"];

export const realmModerationQueueStates = [
  "new",
  "reviewing",
  "actioned",
  "resolved",
  "duplicate",
  "rejected",
  "escalated",
] as const;

export const realmModerationQueueStateSchema = t.Union([
  t.Literal("new"),
  t.Literal("reviewing"),
  t.Literal("actioned"),
  t.Literal("resolved"),
  t.Literal("duplicate"),
  t.Literal("rejected"),
  t.Literal("escalated"),
]);

export const realmModerationDecisionKinds = [
  "approve_for_feed",
  "reject_from_feed",
  "hide_from_realm",
  "remove_from_feed",
  "lock",
  "archive",
  "warn",
  "mute_in_realm",
  "remove_member",
  "ban_from_realm",
  "reject",
  "duplicate",
  "escalate",
] as const;

export const realmModerationDecisionKindSchema = t.Union([
  t.Literal("approve_for_feed"),
  t.Literal("reject_from_feed"),
  t.Literal("hide_from_realm"),
  t.Literal("remove_from_feed"),
  t.Literal("lock"),
  t.Literal("archive"),
  t.Literal("warn"),
  t.Literal("mute_in_realm"),
  t.Literal("remove_member"),
  t.Literal("ban_from_realm"),
  t.Literal("reject"),
  t.Literal("duplicate"),
  t.Literal("escalate"),
]);

export const realmModerationQueueItemDTOSchema = t.Object({
  id: t.String(),
  realmUnitId: t.String(),
  state: realmModerationQueueStateSchema,
  reporterUserId: t.Optional(t.Nullable(t.String())),
  subjectUserId: t.Optional(t.Nullable(t.String())),
  target: moderationTargetRefSchema,
  sourceFeedbackId: t.Optional(t.Nullable(t.String())),
  linkedCaseId: t.Optional(t.Nullable(t.String())),
  assignedToUserId: t.Optional(t.Nullable(t.String())),
  reason: t.Optional(t.Nullable(t.String())),
  safeSummary: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type RealmModerationQueueItemDTO =
  (typeof realmModerationQueueItemDTOSchema)["static"];

export const realmModerationEventDTOSchema = t.Object({
  id: t.String(),
  queueItemId: t.String(),
  realmUnitId: t.String(),
  actorUserId: t.String(),
  decisionKind: t.Optional(t.Nullable(realmModerationDecisionKindSchema)),
  decision: t.Optional(t.Nullable(decisionSchema)),
  reason: t.Optional(t.Nullable(t.String())),
  before: t.Optional(auditMetadataSchema),
  after: t.Optional(auditMetadataSchema),
  createdAt: t.String(),
});

export type RealmModerationEventDTO =
  (typeof realmModerationEventDTOSchema)["static"];

export const createRealmModerationQueueItemSchema = t.Object(
  {
    reporterUserId: t.Optional(t.Nullable(t.String())),
    subjectUserId: t.Optional(t.Nullable(t.String())),
    targetKind: t.String(),
    targetId: t.String(),
    addressedUnitId: t.Optional(t.Nullable(t.String())),
    sourceFeedbackId: t.Optional(t.Nullable(t.String())),
    assignedToUserId: t.Optional(t.Nullable(t.String())),
    reason: t.Optional(t.Nullable(t.String())),
    safeSummary: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(auditMetadataSchema),
  },
  { additionalProperties: false },
);

export type CreateRealmModerationQueueItemInput =
  (typeof createRealmModerationQueueItemSchema)["static"];

export const createRealmModerationQueueItemFromFeedbackSchema = t.Object(
  {
    assignedToUserId: t.Optional(t.Nullable(t.String())),
    reason: t.Optional(t.Nullable(t.String())),
    safeSummary: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(auditMetadataSchema),
  },
  { additionalProperties: false },
);

export type CreateRealmModerationQueueItemFromFeedbackInput =
  (typeof createRealmModerationQueueItemFromFeedbackSchema)["static"];

export const decideRealmModerationQueueItemSchema = t.Object(
  {
    decisionKind: realmModerationDecisionKindSchema,
    reason: t.String({ minLength: 1 }),
    duplicateOfQueueItemId: t.Optional(t.Nullable(t.String())),
    linkedCaseId: t.Optional(t.Nullable(t.String())),
    decision: t.Optional(decisionSchema),
    metadata: t.Optional(auditMetadataSchema),
  },
  { additionalProperties: false },
);

export type DecideRealmModerationQueueItemInput =
  (typeof decideRealmModerationQueueItemSchema)["static"];

export const escalateRealmModerationQueueItemSchema = t.Object(
  {
    reason: t.String({ minLength: 1 }),
    caseId: t.Optional(t.Nullable(t.String())),
    safeSummary: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type EscalateRealmModerationQueueItemInput =
  (typeof escalateRealmModerationQueueItemSchema)["static"];

export const contentModerationStateKinds = [
  "visible",
  "hidden",
  "tombstoned",
  "locked",
  "archived",
  "removed",
] as const;

export const contentModerationStateKindSchema = t.Union([
  t.Literal("visible"),
  t.Literal("hidden"),
  t.Literal("tombstoned"),
  t.Literal("locked"),
  t.Literal("archived"),
  t.Literal("removed"),
]);

export type ContentModerationStateKind =
  (typeof contentModerationStateKindSchema)["static"];

export const contentModerationStateDTOSchema = t.Object({
  moderatedUnitId: t.String(),
  state: contentModerationStateKindSchema,
  decidedByUserId: t.Optional(t.Nullable(t.String())),
  caseId: t.Optional(t.Nullable(t.String())),
  reason: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(auditMetadataSchema),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type ContentModerationStateDTO =
  (typeof contentModerationStateDTOSchema)["static"];

export const realmContentModerationDTOSchema = t.Object({
  realmUnitId: t.String(),
  moderatedUnitId: t.String(),
  state: contentModerationStateKindSchema,
  decidedByUserId: t.Optional(t.Nullable(t.String())),
  caseId: t.Optional(t.Nullable(t.String())),
  reason: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(auditMetadataSchema),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type RealmContentModerationDTO =
  (typeof realmContentModerationDTOSchema)["static"];

export const contentModerationDecisionSchema = t.Object(
  {
    reason: t.String({ minLength: 1 }),
    caseId: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(auditMetadataSchema),
  },
  { additionalProperties: false },
);

export type ContentModerationDecisionInput =
  (typeof contentModerationDecisionSchema)["static"];

export const staffAuditLogDTOSchema = t.Object({
  id: t.String(),
  actorUserId: t.String(),
  action: t.String(),
  targetKind: t.String(),
  targetId: t.String(),
  decisionCode: decisionCodeSchema,
  requestId: t.Optional(t.Nullable(t.String())),
  reason: t.String(),
  before: t.Optional(auditMetadataSchema),
  after: t.Optional(auditMetadataSchema),
  metadata: t.Optional(auditMetadataSchema),
  createdAt: t.String(),
});

export type StaffAuditLogDTO = (typeof staffAuditLogDTOSchema)["static"];
