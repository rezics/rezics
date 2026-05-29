import { t } from "elysia";

// ============================================================
// PROFILE ACTIVITY TIMELINE
// ============================================================
//
// A read-only, time-ordered projection of a user's public activity,
// aggregating their posts/reviews/remarks, given reactions, and shelf
// updates. Privacy and content-lifecycle filtering happen server-side:
// non-public / non-published / removed subjects are omitted at the source,
// never surfaced as gaps or leaked counts.

export const activityKindSchema = t.Union([
  t.Literal("post"),
  t.Literal("review"),
  t.Literal("remark"),
  t.Literal("reaction"),
  t.Literal("shelf"),
]);

export type ActivityKind = (typeof activityKindSchema)["static"];

export const activityItemSchema = t.Object({
  /** Stable identifier: the post/shelf unitId, or the reaction id. */
  id: t.String(),
  kind: activityKindSchema,
  /** Best-effort display title; empty when unknown (client falls back to a kind label). */
  title: t.String(),
  /** App route to the activity's subject. */
  href: t.String(),
  /** ISO timestamp the activity occurred, used for ordering. */
  at: t.String(),
  /** For `kind: "reaction"`, the reaction key (e.g. "like"). */
  reaction: t.Optional(t.String()),
});

export type ActivityItem = (typeof activityItemSchema)["static"];

export const activityListQuerySchema = t.Object({
  /** Return only items strictly older than this ISO timestamp (pagination watermark). */
  before: t.Optional(t.String()),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
});

export type ActivityListQuery = (typeof activityListQuerySchema)["static"];

export const activityListResponseSchema = t.Object({
  items: t.Array(activityItemSchema),
  /** Watermark cursor for the next page (pass back as `before`); null when exhausted. */
  nextCursor: t.Optional(t.Nullable(t.String())),
});

export type ActivityListResponse =
  (typeof activityListResponseSchema)["static"];
