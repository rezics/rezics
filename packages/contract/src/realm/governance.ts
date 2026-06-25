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
  decisionActionId: t.Optional(t.Nullable(t.String())),
  revocationActionId: t.Optional(t.Nullable(t.String())),
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
  "reviewing",
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
  t.Literal("reviewing"),
  t.Literal("triaged"),
  t.Literal("assigned"),
  t.Literal("actioned"),
  t.Literal("resolved"),
  t.Literal("duplicate"),
  t.Literal("rejected"),
  t.Literal("escalated"),
]);

export type ModerationCaseState = (typeof moderationCaseStateSchema)["static"];

export const moderationStatusSchema = t.Union([
  t.Literal("approved"),
  t.Literal("pending"),
  t.Literal("removed"),
]);

export type ModerationStatus = (typeof moderationStatusSchema)["static"];

export const moderationScopeSchema = t.Union([
  t.Literal("platform"),
  t.Literal("realm"),
]);

export type ModerationScope = (typeof moderationScopeSchema)["static"];

export type GovernanceListQuery = {
  offset?: number;
  limit?: number;
  scope?: ModerationScope;
  state?: ModerationCaseState;
};

export type GovernanceAuditListQuery = Omit<
  GovernanceListQuery,
  "scope" | "state"
> & {
  actorUserId?: string;
  action?: string;
  targetKind?: string;
  targetId?: string;
  decisionCode?: string;
  requestId?: string;
};

export const moderationAuthoritySchema = t.Union([
  t.Literal("platform"),
  t.Literal("realm"),
  t.Literal("owner"),
]);

export type ModerationAuthority = (typeof moderationAuthoritySchema)["static"];

export const moderationActorKindSchema = t.Union([
  t.Literal("user"),
  t.Literal("system"),
  t.Literal("automation"),
  t.Literal("import"),
]);

export type ModerationActorKind = (typeof moderationActorKindSchema)["static"];

export const moderationTargetKindSchema = t.Union([
  t.Literal("unit"),
  t.Literal("unit_realm"),
  t.Literal("comment"),
  t.Literal("unit_field"),
  t.Literal("account"),
  t.Literal("realm_member"),
  t.Literal("feedback"),
]);

export type ModerationTargetKind =
  (typeof moderationTargetKindSchema)["static"];

export const moderationActionKindSchema = t.Union([
  t.Literal("approve"),
  t.Literal("remove"),
  t.Literal("restore"),
  t.Literal("lock"),
  t.Literal("unlock"),
  t.Literal("field_lock"),
  t.Literal("field_unlock"),
  t.Literal("warning"),
  t.Literal("silence"),
  t.Literal("suspension"),
  t.Literal("ban"),
  t.Literal("rate_limit"),
  t.Literal("trust_restriction"),
  t.Literal("revoke_enforcement"),
  t.Literal("mute_member"),
  t.Literal("remove_member"),
  t.Literal("ban_member"),
  t.Literal("restore_member"),
  t.Literal("escalate"),
  t.Literal("reverse"),
  t.Literal("note"),
]);

export type ModerationActionKind =
  (typeof moderationActionKindSchema)["static"];

export const moderationTargetRefSchema = t.Object({
  kind: moderationTargetKindSchema,
  id: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
});

export type ModerationTargetRef = (typeof moderationTargetRefSchema)["static"];

export const moderationCaseDTOSchema = t.Object({
  id: t.String(),
  scope: moderationScopeSchema,
  state: moderationCaseStateSchema,
  severity: t.Optional(t.Nullable(t.String())),
  reporterUserId: t.Optional(t.Nullable(t.String())),
  subjectUserId: t.Optional(t.Nullable(t.String())),
  target: moderationTargetRefSchema,
  sourceFeedbackId: t.Optional(t.Nullable(t.String())),
  assignedToUserId: t.Optional(t.Nullable(t.String())),
  parentCaseId: t.Optional(t.Nullable(t.String())),
  duplicateOfCaseId: t.Optional(t.Nullable(t.String())),
  reason: t.Optional(t.Nullable(t.String())),
  safeSummary: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type ModerationCaseDTO = (typeof moderationCaseDTOSchema)["static"];

export const moderationActionDTOSchema = t.Object({
  id: t.String(),
  authority: moderationAuthoritySchema,
  realmUnitId: t.Optional(t.Nullable(t.String())),
  targetKind: moderationTargetKindSchema,
  targetId: t.String(),
  targetPath: t.Optional(t.Nullable(t.String())),
  actorKind: moderationActorKindSchema,
  actorUserId: t.Optional(t.Nullable(t.String())),
  actionKind: moderationActionKindSchema,
  resultingStatus: t.Optional(t.Nullable(moderationStatusSchema)),
  resultingLocked: t.Optional(t.Nullable(t.Boolean())),
  reasonCode: t.String(),
  reasonText: t.Optional(t.Nullable(t.String())),
  publicMessage: t.Optional(t.Nullable(t.String())),
  caseId: t.Optional(t.Nullable(t.String())),
  reversesActionId: t.Optional(t.Nullable(t.String())),
  requestId: t.Optional(t.Nullable(t.String())),
  importedFrom: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
});

export type ModerationActionDTO = (typeof moderationActionDTOSchema)["static"];

export const moderationOverlayDTOSchema = t.Object({
  id: t.String(),
  moderationStatus: moderationStatusSchema,
  latestAction: t.Optional(t.Nullable(moderationActionDTOSchema)),
});

export type ModerationOverlayDTO =
  (typeof moderationOverlayDTOSchema)["static"];

export const moderationOverlayTargetKindSchema = t.Union([
  t.Literal("unit"),
  t.Literal("unit_realm"),
  t.Literal("comment"),
]);

export const moderationOverlayRequestSchema = t.Object({
  targetKind: moderationOverlayTargetKindSchema,
  realmUnitId: t.Optional(t.Nullable(t.String())),
  targetIds: t.Array(t.String(), { maxItems: 200 }),
});

export type ModerationOverlayRequest =
  (typeof moderationOverlayRequestSchema)["static"];

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

export const createRealmModerationCaseSchema = t.Object(
  {
    reporterUserId: t.Optional(t.Nullable(t.String())),
    subjectUserId: t.Optional(t.Nullable(t.String())),
    targetKind: moderationTargetKindSchema,
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

export type CreateRealmModerationCaseInput =
  (typeof createRealmModerationCaseSchema)["static"];

export const createRealmModerationCaseFromFeedbackSchema = t.Object(
  {
    assignedToUserId: t.Optional(t.Nullable(t.String())),
    reason: t.Optional(t.Nullable(t.String())),
    safeSummary: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(auditMetadataSchema),
  },
  { additionalProperties: false },
);

export type CreateRealmModerationCaseFromFeedbackInput =
  (typeof createRealmModerationCaseFromFeedbackSchema)["static"];

export const decideRealmModerationCaseSchema = t.Object(
  {
    actionKind: t.Union([
      t.Literal("approve"),
      t.Literal("remove"),
      t.Literal("lock"),
      t.Literal("warning"),
      t.Literal("mute_member"),
      t.Literal("remove_member"),
      t.Literal("ban_member"),
      t.Literal("reject"),
      t.Literal("duplicate"),
      t.Literal("escalate"),
    ]),
    reason: t.String({ minLength: 1 }),
    duplicateOfCaseId: t.Optional(t.Nullable(t.String())),
    parentCaseId: t.Optional(t.Nullable(t.String())),
    decision: t.Optional(decisionSchema),
    metadata: t.Optional(auditMetadataSchema),
  },
  { additionalProperties: false },
);

export type DecideRealmModerationCaseInput =
  (typeof decideRealmModerationCaseSchema)["static"];

export const escalateRealmModerationCaseSchema = t.Object(
  {
    reason: t.String({ minLength: 1 }),
    caseId: t.Optional(t.Nullable(t.String())),
    safeSummary: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type EscalateRealmModerationCaseInput =
  (typeof escalateRealmModerationCaseSchema)["static"];

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
  metadata: t.Optional(auditMetadataSchema),
  createdAt: t.String(),
});

export type StaffAuditLogDTO = (typeof staffAuditLogDTOSchema)["static"];
