import { t } from "elysia";

export const SystemEmailKind = {
  WORK_LINK_CLAIM_PENDING: "WORK_LINK_CLAIM_PENDING",
  WORK_LINK_CLAIM_APPROVED: "WORK_LINK_CLAIM_APPROVED",
  WORK_LINK_CLAIM_REJECTED: "WORK_LINK_CLAIM_REJECTED",
} as const;
export type SystemEmailKind =
  (typeof SystemEmailKind)[keyof typeof SystemEmailKind];

export const systemEmailKindSchema = t.Union([
  t.Literal(SystemEmailKind.WORK_LINK_CLAIM_PENDING),
  t.Literal(SystemEmailKind.WORK_LINK_CLAIM_APPROVED),
  t.Literal(SystemEmailKind.WORK_LINK_CLAIM_REJECTED),
]);

export const workLinkClaimPendingPayloadSchema = t.Object({
  claimId: t.String(),
  claimerUserId: t.String(),
  workUnitId: t.String(),
  releaseUnitId: t.String(),
  releaseSummary: t.Optional(t.String()),
  workTitle: t.Optional(t.String()),
});
export type WorkLinkClaimPendingPayload =
  (typeof workLinkClaimPendingPayloadSchema)["static"];

export const workLinkClaimApprovedPayloadSchema = t.Object({
  claimId: t.String(),
  workUnitId: t.String(),
  releaseUnitId: t.String(),
  workTitle: t.Optional(t.String()),
});
export type WorkLinkClaimApprovedPayload =
  (typeof workLinkClaimApprovedPayloadSchema)["static"];

export const workLinkClaimRejectedPayloadSchema = t.Object({
  claimId: t.String(),
  workUnitId: t.String(),
  releaseUnitId: t.String(),
  rejectReason: t.Optional(t.String()),
  workTitle: t.Optional(t.String()),
});
export type WorkLinkClaimRejectedPayload =
  (typeof workLinkClaimRejectedPayloadSchema)["static"];

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
