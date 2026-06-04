import { t } from "elysia";

export const adminDashboardStatusStateSchema = t.Union([
  t.Literal("available"),
  t.Literal("degraded"),
  t.Literal("unavailable"),
  t.Literal("unknown"),
]);

export const adminStatsResponseSchema = t.Object({
  counts: t.Object({
    users: t.Number(),
    books: t.Number(),
    comments: t.Number(),
    unresolvedFeedback: t.Number(),
    historyOutboxPending: t.Number(),
    historyOutboxFailed: t.Number(),
  }),
  health: t.Object({
    server: t.Union([t.Literal("ok"), t.Literal("degraded")]),
    meili: t.Union([t.Literal("ok"), t.Literal("unreachable")]),
  }),
  contentTrend: t.Array(
    t.Object({
      date: t.String(),
      books: t.Number(),
      comments: t.Number(),
    }),
  ),
});

export type AdminStatsResponse = (typeof adminStatsResponseSchema)["static"];

export const adminDashboardSummarySchema = t.Object({
  checkedAt: t.String(),
  system: t.Object({
    status: adminDashboardStatusStateSchema,
    affectedItems: t.Number(),
    link: t.String(),
  }),
  queue: t.Object({
    status: adminDashboardStatusStateSchema,
    lanes: t.Number(),
    activeJobs: t.Number(),
    retryJobs: t.Number(),
    failedJobs: t.Number(),
    link: t.String(),
  }),
  search: t.Object({
    status: adminDashboardStatusStateSchema,
    driftedIndexes: t.Number(),
    indexingIndexes: t.Number(),
    failedTasks: t.Number(),
    documentCount: t.Number(),
    link: t.String(),
  }),
  governance: t.Object({
    openCases: t.Number(),
    escalatedCases: t.Number(),
    realmCasesOpen: t.Number(),
    realmCasesEscalated: t.Number(),
    activeEnforcements: t.Number(),
    link: t.String(),
  }),
  audit: t.Object({
    recent: t.Array(
      t.Object({
        id: t.String(),
        action: t.String(),
        targetKind: t.String(),
        targetId: t.String(),
        actorUserId: t.String(),
        decisionCode: t.String(),
        createdAt: t.String(),
        link: t.String(),
      }),
    ),
    link: t.String(),
  }),
  repairWarnings: t.Array(
    t.Object({
      id: t.String(),
      severity: t.Union([
        t.Literal("info"),
        t.Literal("warning"),
        t.Literal("error"),
      ]),
      title: t.String(),
      description: t.Optional(t.String()),
      source: t.Union([
        t.Literal("system"),
        t.Literal("queue"),
        t.Literal("search"),
        t.Literal("history"),
        t.Literal("governance"),
      ]),
      count: t.Optional(t.Number()),
      link: t.String(),
    }),
  ),
});

export type AdminDashboardSummary =
  (typeof adminDashboardSummarySchema)["static"];
