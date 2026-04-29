import { t } from "elysia";

// ============================================================
// PATH PARAMS
// ============================================================

export const workLinkPathParamsSchema = t.Object({
  releaseId: t.String(),
});

export type WorkLinkPathParams = (typeof workLinkPathParamsSchema)["static"];

// ============================================================
// REQUEST
// ============================================================

/**
 * `PATCH /units/:releaseId/work-link` body. `null` clears the link and
 * cascades any associated PENDING WorkLinkClaim rows to WITHDRAWN.
 */
export const workLinkBodySchema = t.Object({
  workUnitId: t.Nullable(t.String()),
});

export type WorkLinkBody = (typeof workLinkBodySchema)["static"];

// ============================================================
// RESPONSE
// ============================================================

export const workLinkStatusSchema = t.Union([
  t.Literal("LINKED"),
  t.Literal("PENDING"),
  t.Literal("UNLINKED"),
]);

export type WorkLinkStatus = (typeof workLinkStatusSchema)["static"];

/**
 * - `LINKED` — `Unit.workUnitId` was set immediately. `autoApproved=true`
 *   means the wiki short-circuit applied (target work type ∈ WIKI_TYPES);
 *   omitted otherwise.
 * - `PENDING` — A `WorkLinkClaim` was created (or refreshed); `claimId` is
 *   the existing or new claim row id. `Unit.workUnitId` is unchanged.
 * - `UNLINKED` — `Unit.workUnitId` was cleared; pending claims for this
 *   release were cascaded to WITHDRAWN.
 */
export const workLinkResponseSchema = t.Object({
  status: workLinkStatusSchema,
  claimId: t.Optional(t.String()),
  autoApproved: t.Optional(t.Boolean()),
});

export type WorkLinkResponse = (typeof workLinkResponseSchema)["static"];
