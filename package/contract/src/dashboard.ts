import { type TSchema, t } from "elysia";
import { draftMetadataSchema } from "./draft";

// ============================================================
// DASHBOARD SUMMARY
// ============================================================
//
// The signed-in dashboard aggregates user continuity across domains on
// the server so the client never scatters and re-aggregates domain
// requests. Each section is wrapped in a partial-success discriminator
// so the page can render the sections that loaded and show a retry
// state for the ones that failed.

/** Stable error codes for a failed dashboard section. */
export const dashboardSectionErrorSchema = t.Object({
  code: t.String(),
  retryable: t.Boolean(),
});

export type DashboardSectionError =
  (typeof dashboardSectionErrorSchema)["static"];

/**
 * Wrap a section payload in `{ ok } | { error }`. Aggregation tolerates
 * per-section failure without failing the whole response.
 */
export const dashboardSection = <T extends TSchema>(payload: T) =>
  t.Union([
    t.Object({ ok: payload }),
    t.Object({ error: dashboardSectionErrorSchema }),
  ]);

export type DashboardSectionResult<T> =
  | { ok: T }
  | { error: DashboardSectionError };

// ------------------------------------------------------------
// continue-reading
// ------------------------------------------------------------

/**
 * Discriminated resume route so the client navigates without re-deriving
 * the URL. `node` preserves multi-link TOC disambiguation.
 */
export const resumeRouteSchema = t.Union([
  t.Object({
    kind: t.Literal("node"),
    bookId: t.String(),
    nodeId: t.String(),
  }),
  t.Object({
    kind: t.Literal("chapter"),
    bookId: t.String(),
    chapterId: t.String(),
  }),
  t.Object({
    kind: t.Literal("book"),
    bookId: t.String(),
  }),
]);

export type ResumeRoute = (typeof resumeRouteSchema)["static"];

export const continueReadingItemSchema = t.Object({
  bookUnitId: t.String(),
  bookTitle: t.String(),
  bookCoverUrl: t.Optional(t.String()),
  /** Null for legacy/first-time progress without a node anchor. */
  lastReadNodeId: t.Nullable(t.String()),
  /** Server-resolved from the TOC; null when no node or node hard-deleted. */
  lastReadNodeTitle: t.Nullable(t.String()),
  /** `lastReadAnchor.text` truncated to <= 200 chars, when present. */
  lastReadAnchorText: t.Optional(t.String()),
  chaptersCompleted: t.Integer({ minimum: 0 }),
  chaptersTotal: t.Integer({ minimum: 0 }),
  resumeRoute: resumeRouteSchema,
});

export type ContinueReadingItem = (typeof continueReadingItemSchema)["static"];

// ------------------------------------------------------------
// lightweight per-section card summaries
// ------------------------------------------------------------

export const dashboardShelfSummarySchema = t.Object({
  shelfUnitId: t.String(),
  title: t.String(),
  itemCount: t.Integer({ minimum: 0 }),
  coverUrls: t.Array(t.String(), { maxItems: 4 }),
});

export const dashboardRealmSummarySchema = t.Object({
  realmId: t.String(),
  name: t.String(),
  slug: t.Optional(t.String()),
  avatarUrl: t.Optional(t.String()),
  unreadCount: t.Optional(t.Integer({ minimum: 0 })),
});

export const dashboardNotificationSummarySchema = t.Object({
  unreadCount: t.Integer({ minimum: 0 }),
  latestKindKeys: t.Array(t.String(), { maxItems: 5 }),
});

export const dashboardDmSummarySchema = t.Object({
  unreadCount: t.Integer({ minimum: 0 }),
  conversationCount: t.Integer({ minimum: 0 }),
});

export const dashboardActivityItemSchema = t.Object({
  kind: t.String(),
  targetUnitId: t.Optional(t.String()),
  title: t.String(),
  at: t.String(),
});

/**
 * Safety / moderation status surfaced only when relevant. `null` ok value
 * means there is nothing to show.
 */
export const dashboardSafetySchema = t.Object({
  enforcementActive: t.Boolean(),
  accountBlocked: t.Boolean(),
  pendingReportsAgainstUser: t.Integer({ minimum: 0 }),
  notices: t.Array(t.Object({ code: t.String(), message: t.String() }), {
    maxItems: 10,
  }),
});

// ------------------------------------------------------------
// aggregate
// ------------------------------------------------------------

export const dashboardSummarySchema = t.Object({
  continueReading: dashboardSection(t.Array(continueReadingItemSchema)),
  shelves: dashboardSection(t.Array(dashboardShelfSummarySchema)),
  realms: dashboardSection(t.Array(dashboardRealmSummarySchema)),
  notifications: dashboardSection(dashboardNotificationSummarySchema),
  dms: dashboardSection(dashboardDmSummarySchema),
  drafts: dashboardSection(t.Array(draftMetadataSchema)),
  activity: dashboardSection(t.Array(dashboardActivityItemSchema)),
  safety: dashboardSection(dashboardSafetySchema),
});

export type DashboardSummary = {
  continueReading: DashboardSectionResult<ContinueReadingItem[]>;
  shelves: DashboardSectionResult<
    (typeof dashboardShelfSummarySchema)["static"][]
  >;
  realms: DashboardSectionResult<
    (typeof dashboardRealmSummarySchema)["static"][]
  >;
  notifications: DashboardSectionResult<
    (typeof dashboardNotificationSummarySchema)["static"]
  >;
  dms: DashboardSectionResult<(typeof dashboardDmSummarySchema)["static"]>;
  drafts: DashboardSectionResult<(typeof draftMetadataSchema)["static"][]>;
  activity: DashboardSectionResult<
    (typeof dashboardActivityItemSchema)["static"][]
  >;
  safety: DashboardSectionResult<(typeof dashboardSafetySchema)["static"]>;
};

export type DashboardShelfSummary =
  (typeof dashboardShelfSummarySchema)["static"];
export type DashboardRealmSummary =
  (typeof dashboardRealmSummarySchema)["static"];
export type DashboardNotificationSummary =
  (typeof dashboardNotificationSummarySchema)["static"];
export type DashboardDmSummary = (typeof dashboardDmSummarySchema)["static"];
export type DashboardActivityItem =
  (typeof dashboardActivityItemSchema)["static"];
export type DashboardSafety = (typeof dashboardSafetySchema)["static"];
