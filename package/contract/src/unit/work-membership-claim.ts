import { t } from "elysia";

// ============================================================
// CLAIM STATUS (mirrors Prisma `ClaimStatus` enum)
// ============================================================

export const ClaimStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
} as const;

export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export const claimStatusSchema = t.Union([
  t.Literal("PENDING"),
  t.Literal("APPROVED"),
  t.Literal("REJECTED"),
  t.Literal("WITHDRAWN"),
]);

// ============================================================
// CLAIM DTO
// ============================================================

export const workMembershipClaimDTOSchema = t.Object({
  id: t.String(),
  releaseUnitId: t.String(),
  workUnitId: t.String(),
  claimerUserId: t.String(),
  status: claimStatusSchema,
  rejectReason: t.Optional(t.Nullable(t.String())),
  createdAt: t.Union([t.String(), t.Date()]),
  resolvedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  resolvedBy: t.Optional(t.Nullable(t.String())),
});

export type WorkMembershipClaimDTO =
  (typeof workMembershipClaimDTOSchema)["static"];

// ============================================================
// LIST (inbox)
// ============================================================

export const workMembershipClaimListPathParamsSchema = t.Object({
  workUnitId: t.String(),
});

export type WorkMembershipClaimListPathParams =
  (typeof workMembershipClaimListPathParamsSchema)["static"];

export const workMembershipClaimListQuerySchema = t.Object({
  status: t.Optional(claimStatusSchema),
});

export type WorkMembershipClaimListQuery =
  (typeof workMembershipClaimListQuerySchema)["static"];

export const workMembershipClaimListResponseSchema = t.Object({
  claims: t.Array(workMembershipClaimDTOSchema),
});

export type WorkMembershipClaimListResponse =
  (typeof workMembershipClaimListResponseSchema)["static"];

// ============================================================
// CLAIM ACTION PATH PARAMS (approve / reject / withdraw)
// ============================================================

export const workMembershipClaimActionPathParamsSchema = t.Object({
  claimId: t.String(),
});

export type WorkMembershipClaimActionPathParams =
  (typeof workMembershipClaimActionPathParamsSchema)["static"];

// ============================================================
// REJECT BODY
// ============================================================

export const workMembershipClaimRejectBodySchema = t.Object({
  reason: t.Optional(t.String({ maxLength: 1000 })),
});

export type WorkMembershipClaimRejectBody =
  (typeof workMembershipClaimRejectBodySchema)["static"];

// ============================================================
// CLAIM RESPONSE (single-row, used by approve/reject/withdraw)
// ============================================================

export const workMembershipClaimResponseSchema = workMembershipClaimDTOSchema;
export type WorkMembershipClaimResponse =
  (typeof workMembershipClaimResponseSchema)["static"];
