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

export const workLinkClaimDTOSchema = t.Object({
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

export type WorkLinkClaimDTO = (typeof workLinkClaimDTOSchema)["static"];

// ============================================================
// LIST (inbox)
// ============================================================

export const workLinkClaimListPathParamsSchema = t.Object({
  workUnitId: t.String(),
});

export type WorkLinkClaimListPathParams =
  (typeof workLinkClaimListPathParamsSchema)["static"];

export const workLinkClaimListQuerySchema = t.Object({
  status: t.Optional(claimStatusSchema),
});

export type WorkLinkClaimListQuery =
  (typeof workLinkClaimListQuerySchema)["static"];

export const workLinkClaimListResponseSchema = t.Object({
  claims: t.Array(workLinkClaimDTOSchema),
});

export type WorkLinkClaimListResponse =
  (typeof workLinkClaimListResponseSchema)["static"];

// ============================================================
// CLAIM ACTION PATH PARAMS (approve / reject / withdraw)
// ============================================================

export const workLinkClaimActionPathParamsSchema = t.Object({
  claimId: t.String(),
});

export type WorkLinkClaimActionPathParams =
  (typeof workLinkClaimActionPathParamsSchema)["static"];

// ============================================================
// REJECT BODY
// ============================================================

export const workLinkClaimRejectBodySchema = t.Object({
  reason: t.Optional(t.String({ maxLength: 1000 })),
});

export type WorkLinkClaimRejectBody =
  (typeof workLinkClaimRejectBodySchema)["static"];

// ============================================================
// CLAIM RESPONSE (single-row, used by approve/reject/withdraw)
// ============================================================

export const workLinkClaimResponseSchema = workLinkClaimDTOSchema;
export type WorkLinkClaimResponse =
  (typeof workLinkClaimResponseSchema)["static"];
