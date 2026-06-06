import type {
  AdminDashboardSummary,
  AdminStatsResponse,
} from "@rezics/contract";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  StatusState,
  SystemStatusSummary,
} from "@/diagnostic/status.types";
import { getSystemStatusSummary } from "@/diagnostic/system-status.service";
import { searchClient } from "@/meili/search-client";
import {
  AccountEnforcement,
  Book,
  Feedback,
  HistoryOutbox,
  ModerationCase,
  Post,
  StaffAuditLog,
  User,
} from "../db/schema";

const ADMIN_ROUTES = {
  audit: "/governance",
  governance: "/governance",
  history: "/status",
  queue: "/status",
  search: "/meili",
  system: "/status",
} as const;

const OPEN_MODERATION_CASE_STATES = [
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "ESCALATED",
] as const;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

type TrendRow = { date: Date; count: bigint };

async function loadContentTrendRows(
  tableName: "Book" | "Post",
  startDate: Date,
): Promise<TrendRow[]> {
  const db = await getServerDb();
  const result = await db.execute<TrendRow>(sql`
    SELECT date_trunc('day', "createdAt")::date AS date, COUNT(*)::bigint AS count
    FROM ${sql.identifier(tableName)}
    WHERE "createdAt" >= ${startDate}
    GROUP BY date
    ORDER BY date ASC
  `);
  return result.rows;
}

export class StatsService {
  async getStats(): Promise<AdminStatsResponse> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const db = await getServerDb();

    const [
      userRows,
      bookRows,
      postRows,
      unresolvedFeedbackRows,
      historyOutboxPendingRows,
      historyOutboxFailedRows,
      meiliHealthy,
      bookTrend,
      postTrend,
    ] = await Promise.all([
      db.select({ total: count() }).from(User),
      db.select({ total: count() }).from(Book),
      db.select({ total: count() }).from(Post),
      db
        .select({ total: count() })
        .from(Feedback)
        .where(eq(Feedback.resolved, false)),
      db
        .select({ total: count() })
        .from(HistoryOutbox)
        .where(eq(HistoryOutbox.status, "pending")),
      db
        .select({ total: count() })
        .from(HistoryOutbox)
        .where(eq(HistoryOutbox.status, "failed")),
      this.checkMeiliHealth(),
      loadContentTrendRows("Book", thirtyDaysAgo),
      loadContentTrendRows("Post", thirtyDaysAgo),
    ]);

    const contentTrend = this.buildContentTrend(
      thirtyDaysAgo,
      bookTrend,
      postTrend,
    );

    return {
      counts: {
        users: userRows[0]?.total ?? 0,
        books: bookRows[0]?.total ?? 0,
        comments: postRows[0]?.total ?? 0,
        unresolvedFeedback: unresolvedFeedbackRows[0]?.total ?? 0,
        historyOutboxPending: historyOutboxPendingRows[0]?.total ?? 0,
        historyOutboxFailed: historyOutboxFailedRows[0]?.total ?? 0,
      },
      health: {
        server: "ok",
        meili: meiliHealthy ? "ok" : "unreachable",
      },
      contentTrend,
    };
  }

  async getDashboardSummary(): Promise<AdminDashboardSummary> {
    const [stats, system, governanceCounts, recentAudit] = await Promise.all([
      this.getStats(),
      getSystemStatusSummary(),
      this.getGovernanceCounts(),
      this.getRecentAudit(),
    ]);

    return {
      checkedAt: new Date().toISOString(),
      system: this.buildSystemSummary(system),
      queue: this.buildQueueSummary(system),
      search: this.buildSearchSummary(system),
      governance: {
        ...governanceCounts,
        link: ADMIN_ROUTES.governance,
      },
      audit: {
        recent: recentAudit,
        link: ADMIN_ROUTES.audit,
      },
      repairWarnings: this.buildRepairWarnings(stats, system, governanceCounts),
    };
  }

  private async checkMeiliHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const healthy = await searchClient.checkHealth();
      clearTimeout(timeout);
      return healthy;
    } catch {
      return false;
    }
  }

  private buildContentTrend(
    startDate: Date,
    bookTrend: { date: Date; count: bigint }[],
    postTrend: { date: Date; count: bigint }[],
  ): AdminStatsResponse["contentTrend"] {
    const bookMap = new Map(
      bookTrend.map((r) => [
        r.date.toISOString().slice(0, 10),
        Number(r.count),
      ]),
    );
    const postMap = new Map(
      postTrend.map((r) => [
        r.date.toISOString().slice(0, 10),
        Number(r.count),
      ]),
    );

    const result: AdminStatsResponse["contentTrend"] = [];
    const current = new Date(startDate);
    const today = new Date();

    while (current <= today) {
      const dateStr = current.toISOString().slice(0, 10);
      result.push({
        date: dateStr,
        books: bookMap.get(dateStr) ?? 0,
        comments: postMap.get(dateStr) ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  private buildSystemSummary(
    system: SystemStatusSummary,
  ): AdminDashboardSummary["system"] {
    const affectedItems = [
      ...system.services,
      ...system.databases,
      system.queue.item,
      system.sequin,
    ].filter(
      (item) => item.status === "degraded" || item.status === "unavailable",
    ).length;

    return {
      status: system.status,
      affectedItems,
      link: ADMIN_ROUTES.system,
    };
  }

  private buildQueueSummary(
    system: SystemStatusSummary,
  ): AdminDashboardSummary["queue"] {
    const counts = system.queue.counts;
    return {
      status: system.queue.item.status,
      lanes: counts.length,
      activeJobs: counts.reduce((sum, lane) => sum + lane.active, 0),
      retryJobs: counts.reduce((sum, lane) => sum + lane.retry, 0),
      failedJobs: counts.reduce((sum, lane) => sum + lane.failed, 0),
      link: ADMIN_ROUTES.queue,
    };
  }

  private buildSearchSummary(
    system: SystemStatusSummary,
  ): AdminDashboardSummary["search"] {
    const indexes = system.meili.indexes;
    return {
      status: system.meili.status,
      driftedIndexes: indexes.filter((index) => index.settingsDrift?.hasDrift)
        .length,
      indexingIndexes: indexes.filter((index) => index.isIndexing).length,
      failedTasks: system.meili.tasks.filter((task) => task.status === "failed")
        .length,
      documentCount: indexes.reduce(
        (sum, index) => sum + (index.numberOfDocuments ?? 0),
        0,
      ),
      link: ADMIN_ROUTES.search,
    };
  }

  private async getGovernanceCounts(): Promise<
    Omit<AdminDashboardSummary["governance"], "link">
  > {
    const db = await getServerDb();
    const [
      openCaseRows,
      escalatedCaseRows,
      realmCasesOpenRows,
      realmCasesEscalatedRows,
      activeEnforcementRows,
    ] = await Promise.all([
      db
        .select({ total: count() })
        .from(ModerationCase)
        .where(inArray(ModerationCase.state, [...OPEN_MODERATION_CASE_STATES])),
      db
        .select({ total: count() })
        .from(ModerationCase)
        .where(eq(ModerationCase.state, "ESCALATED")),
      db
        .select({ total: count() })
        .from(ModerationCase)
        .where(
          and(
            eq(ModerationCase.scope, "REALM"),
            inArray(ModerationCase.state, [...OPEN_MODERATION_CASE_STATES]),
          ),
        ),
      db
        .select({ total: count() })
        .from(ModerationCase)
        .where(
          and(
            eq(ModerationCase.scope, "REALM"),
            eq(ModerationCase.state, "ESCALATED"),
          ),
        ),
      db
        .select({ total: count() })
        .from(AccountEnforcement)
        .where(eq(AccountEnforcement.state, "ACTIVE")),
    ]);

    return {
      openCases: openCaseRows[0]?.total ?? 0,
      escalatedCases: escalatedCaseRows[0]?.total ?? 0,
      realmCasesOpen: realmCasesOpenRows[0]?.total ?? 0,
      realmCasesEscalated: realmCasesEscalatedRows[0]?.total ?? 0,
      activeEnforcements: activeEnforcementRows[0]?.total ?? 0,
    };
  }

  private async getRecentAudit(): Promise<
    AdminDashboardSummary["audit"]["recent"]
  > {
    const db = await getServerDb();
    const rows = await db
      .select({
        id: StaffAuditLog.id,
        action: StaffAuditLog.action,
        targetKind: StaffAuditLog.targetKind,
        targetId: StaffAuditLog.targetId,
        actorUserId: StaffAuditLog.actorUserId,
        decisionCode: StaffAuditLog.decisionCode,
        createdAt: StaffAuditLog.createdAt,
      })
      .from(StaffAuditLog)
      .orderBy(desc(StaffAuditLog.createdAt))
      .limit(5);

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetKind: row.targetKind,
      targetId: row.targetId,
      actorUserId: row.actorUserId,
      decisionCode: row.decisionCode,
      createdAt: row.createdAt.toISOString(),
      link: `${ADMIN_ROUTES.audit}?auditLogId=${encodeURIComponent(row.id)}`,
    }));
  }

  private buildRepairWarnings(
    stats: AdminStatsResponse,
    system: SystemStatusSummary,
    governance: Omit<AdminDashboardSummary["governance"], "link">,
  ): AdminDashboardSummary["repairWarnings"] {
    const warnings: AdminDashboardSummary["repairWarnings"] = [];

    const pushStatusWarning = (input: {
      id: string;
      status: StatusState;
      title: string;
      description?: string;
      source: AdminDashboardSummary["repairWarnings"][number]["source"];
      link: string;
    }) => {
      if (input.status !== "degraded" && input.status !== "unavailable") return;
      const warning: AdminDashboardSummary["repairWarnings"][number] = {
        id: input.id,
        severity: input.status === "unavailable" ? "error" : "warning",
        title: input.title,
        source: input.source,
        link: input.link,
      };
      if (input.description) warning.description = input.description;
      warnings.push(warning);
    };

    pushStatusWarning({
      id: "system-status",
      status: system.status,
      title: "System status needs review",
      description:
        "One or more services, databases, or sync surfaces are degraded.",
      source: "system",
      link: ADMIN_ROUTES.system,
    });
    pushStatusWarning({
      id: "queue-status",
      status: system.queue.item.status,
      title: "Job queue has failed work",
      description: system.queue.item.reason,
      source: "queue",
      link: ADMIN_ROUTES.queue,
    });
    pushStatusWarning({
      id: "search-status",
      status: system.meili.status,
      title: "Search status needs repair",
      description: system.meili.reason,
      source: "search",
      link: ADMIN_ROUTES.search,
    });
    const driftedIndexes = system.meili.indexes.filter(
      (index) => index.settingsDrift?.hasDrift,
    ).length;
    if (driftedIndexes > 0) {
      warnings.push({
        id: "search-settings-drift",
        severity: "warning",
        title: "Search index settings drift detected",
        description: `${driftedIndexes} Meili index settings need review.`,
        source: "search",
        count: driftedIndexes,
        link: ADMIN_ROUTES.search,
      });
    }

    if (stats.counts.historyOutboxFailed > 0) {
      warnings.push({
        id: "history-outbox-failed",
        severity: "error",
        title: "History outbox has failed records",
        description:
          "Failed history sync records should be retried or repaired.",
        source: "history",
        count: stats.counts.historyOutboxFailed,
        link: ADMIN_ROUTES.history,
      });
    }

    if (governance.escalatedCases > 0 || governance.realmCasesEscalated > 0) {
      warnings.push({
        id: "governance-escalations",
        severity: "warning",
        title: "Governance escalations need operator review",
        description:
          "Escalated site-wide or realm moderation items are waiting.",
        source: "governance",
        count: governance.escalatedCases + governance.realmCasesEscalated,
        link: ADMIN_ROUTES.governance,
      });
    }

    return warnings;
  }
}

export const statsService = new StatsService();
