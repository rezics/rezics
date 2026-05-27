import { t } from "elysia";

export const SystemEmailKind = {
  WORK_MEMBERSHIP_CLAIM_PENDING: "WORK_MEMBERSHIP_CLAIM_PENDING",
  WORK_MEMBERSHIP_CLAIM_APPROVED: "WORK_MEMBERSHIP_CLAIM_APPROVED",
  WORK_MEMBERSHIP_CLAIM_REJECTED: "WORK_MEMBERSHIP_CLAIM_REJECTED",
} as const;
export type SystemEmailKind =
  (typeof SystemEmailKind)[keyof typeof SystemEmailKind];

export const systemEmailKindSchema = t.Union([
  t.Literal(SystemEmailKind.WORK_MEMBERSHIP_CLAIM_PENDING),
  t.Literal(SystemEmailKind.WORK_MEMBERSHIP_CLAIM_APPROVED),
  t.Literal(SystemEmailKind.WORK_MEMBERSHIP_CLAIM_REJECTED),
]);

export const workMembershipClaimPendingPayloadSchema = t.Object({
  claimId: t.String(),
  claimerUserId: t.String(),
  workUnitId: t.String(),
  releaseUnitId: t.String(),
  releaseSummary: t.Optional(t.String()),
  workTitle: t.Optional(t.String()),
});
export type WorkMembershipClaimPendingPayload =
  (typeof workMembershipClaimPendingPayloadSchema)["static"];

export const workMembershipClaimApprovedPayloadSchema = t.Object({
  claimId: t.String(),
  workUnitId: t.String(),
  releaseUnitId: t.String(),
  workTitle: t.Optional(t.String()),
});
export type WorkMembershipClaimApprovedPayload =
  (typeof workMembershipClaimApprovedPayloadSchema)["static"];

export const workMembershipClaimRejectedPayloadSchema = t.Object({
  claimId: t.String(),
  workUnitId: t.String(),
  releaseUnitId: t.String(),
  rejectReason: t.Optional(t.String()),
  workTitle: t.Optional(t.String()),
});
export type WorkMembershipClaimRejectedPayload =
  (typeof workMembershipClaimRejectedPayloadSchema)["static"];

export const systemEmailBodySchema = t.Object({
  userId: t.String(),
  kind: systemEmailKindSchema,
  payload: t.Any(),
  locale: t.Optional(t.String()),
});
export type SystemEmailBody = (typeof systemEmailBodySchema)["static"];

export const systemEmailResponseSchema = t.Object({
  success: t.Boolean(),
  notificationId: t.Optional(t.String()),
  deduplicated: t.Optional(t.Boolean()),
});
export type SystemEmailResponse = (typeof systemEmailResponseSchema)["static"];
