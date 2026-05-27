import { t } from "elysia";

// ============================================================
// PATH PARAMS
// ============================================================

export const unitWorkMembershipPathParamsSchema = t.Object({
  releaseId: t.String(),
});

export type UnitWorkMembershipPathParams =
  (typeof unitWorkMembershipPathParamsSchema)["static"];

// ============================================================
// REQUEST
// ============================================================

/**
 * `PATCH /unit/:releaseId/work-membership` body. `null` clears the release
 * membership and cascades associated PENDING membership claims to WITHDRAWN.
 */
export const unitWorkMembershipBodySchema = t.Object({
  workUnitId: t.Nullable(t.String()),
});

export type UnitWorkMembershipBody =
  (typeof unitWorkMembershipBodySchema)["static"];

// ============================================================
// RESPONSE
// ============================================================

export const unitWorkMembershipStatusSchema = t.Union([
  t.Literal("LINKED"),
  t.Literal("PENDING"),
  t.Literal("UNLINKED"),
]);

export type UnitWorkMembershipStatus =
  (typeof unitWorkMembershipStatusSchema)["static"];

/**
 * - `LINKED` — `UnitWork(role = RELEASE)` was created immediately. `autoApproved=true`
 *   means the wiki short-circuit applied (target work type ∈ WIKI_TYPES);
 *   omitted otherwise.
 * - `PENDING` — A membership claim was created (or refreshed); `claimId` is
 *   the existing or new claim row id. Existing UnitWork membership is unchanged.
 * - `UNLINKED` — release UnitWork membership was cleared; pending claims for this
 *   release were cascaded to WITHDRAWN.
 */
export const unitWorkMembershipResponseSchema = t.Object({
  status: unitWorkMembershipStatusSchema,
  claimId: t.Optional(t.String()),
  autoApproved: t.Optional(t.Boolean()),
});

export type UnitWorkMembershipResponse =
  (typeof unitWorkMembershipResponseSchema)["static"];
