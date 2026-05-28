import type { AdminDashboardSummary } from "@rezics/api/stat/stats";
import {
  adminDashboardSummaryQueryOptions,
  adminStatsQueryOptions,
} from "@rezics/api/stat/stats.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Activity,
  DatabaseZap,
  MessageCircle as CommentIcon,
  MessageCircleQuestion as FeedbackIcon,
  History as HistoryIcon,
  BookOpen as MenuBookIcon,
  SearchCheck,
  ShieldAlert,
  Users as PeopleIcon,
  Wrench,
} from "lucide-react";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";
import { ContentTrendChart } from "../components/chart/ContentTrendChart";
import { StatCard } from "../components/StatCard";

type DashboardStatus = AdminDashboardSummary["system"]["status"];

function statusLabel(status: DashboardStatus) {
  switch (status) {
    case "available":
      return "可用";
    case "degraded":
      return "降級";
    case "unavailable":
      return "不可用";
    case "unknown":
      return "未知";
  }
}

function statusBadgeVariant(status: DashboardStatus) {
  return status === "available" ? "secondary" : "destructive";
}

function SummaryMetricCard({
  title,
  status,
  href,
  icon,
  children,
}: {
  title: string;
  status: DashboardStatus;
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full border-border-whisper bg-surface-base">
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-subtle text-text-secondary">
              {icon}
            </span>
            <p className="truncate text-sm font-semibold leading-[1.4]">
              {title}
            </p>
          </div>
          <Badge variant={statusBadgeVariant(status)}>
            {statusLabel(status)}
          </Badge>
        </div>
        <div className="grid gap-2 text-sm leading-[1.4] text-text-secondary">
          {children}
        </div>
        <Link
          to={href}
          className="mt-auto text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          查看詳情
        </Link>
      </CardContent>
    </Card>
  );
}

function DashboardOperationsSummary({
  summary,
}: {
  summary: AdminDashboardSummary;
}) {
  const warnings = summary.repairWarnings.slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryMetricCard
          title="系統狀態"
          status={summary.system.status}
          href={summary.system.link}
          icon={<Activity className="size-4" />}
        >
          <p>受影響項目 {summary.system.affectedItems} 個</p>
          <p className="text-xs text-text-tertiary">
            最後檢查 {new Date(summary.checkedAt).toLocaleString("zh-Hant")}
          </p>
        </SummaryMetricCard>

        <SummaryMetricCard
          title="Job-runner"
          status={summary.queue.status}
          href={summary.queue.link}
          icon={<DatabaseZap className="size-4" />}
        >
          <p>{summary.queue.lanes} lanes</p>
          <p>
            執行中 {summary.queue.activeJobs} · 重試 {summary.queue.retryJobs} ·
            失敗 {summary.queue.failedJobs}
          </p>
        </SummaryMetricCard>

        <SummaryMetricCard
          title="Search"
          status={summary.search.status}
          href={summary.search.link}
          icon={<SearchCheck className="size-4" />}
        >
          <p>文件 {summary.search.documentCount.toLocaleString()}</p>
          <p>
            漂移 {summary.search.driftedIndexes} · 索引中{" "}
            {summary.search.indexingIndexes} · 失敗任務{" "}
            {summary.search.failedTasks}
          </p>
        </SummaryMetricCard>

        <SummaryMetricCard
          title="Governance"
          status={
            summary.governance.escalatedCases > 0 ||
            summary.governance.realmQueueEscalated > 0
              ? "degraded"
              : "available"
          }
          href={summary.governance.link}
          icon={<ShieldAlert className="size-4" />}
        >
          <p>
            開啟案件 {summary.governance.openCases} · Realm queue{" "}
            {summary.governance.realmQueueOpen}
          </p>
          <p>
            升級{" "}
            {summary.governance.escalatedCases +
              summary.governance.realmQueueEscalated}{" "}
            · 生效處置 {summary.governance.activeEnforcements}
          </p>
        </SummaryMetricCard>
      </div>

      <Card className="border-border-whisper bg-surface-base">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-sm bg-surface-subtle text-text-secondary">
              <Wrench className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-[1.4]">修復警示</p>
              <p className="text-xs leading-[1.4] text-text-secondary">
                {summary.repairWarnings.length} 個作用中警示
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {warnings.length ? (
              warnings.map((warning) => (
                <Link
                  key={warning.id}
                  to={warning.link}
                  className="block rounded-sm border border-border-whisper p-3 no-underline hover:bg-surface-subtle"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-[1.4] text-text-primary">
                      {warning.title}
                    </p>
                    <Badge
                      variant={
                        warning.severity === "error"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {warning.source}
                    </Badge>
                  </div>
                  {warning.description ? (
                    <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
                      {warning.description}
                    </p>
                  ) : null}
                </Link>
              ))
            ) : (
              <p className="rounded-sm bg-surface-subtle p-3 text-sm text-text-secondary">
                目前沒有作用中的修復警示。
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation(["admin"]);
  const { data: stats } = useSuspenseQuery(adminStatsQueryOptions());
  const { data: dashboardSummary } = useSuspenseQuery(
    adminDashboardSummaryQueryOptions(),
  );

  return (
    <Page
      title={t("admin:dashboard_title")}
      description={t("admin:dashboard_description")}
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={t("admin:dashboard_total_users")}
            value={stats.counts.users}
            icon={<PeopleIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={t("admin:dashboard_total_books")}
            value={stats.counts.books}
            icon={<MenuBookIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={t("admin:dashboard_comments")}
            value={stats.counts.comments}
            icon={<CommentIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={t("admin:dashboard_unresolved_feedback")}
            value={stats.counts.unresolvedFeedback}
            icon={<FeedbackIcon />}
            color={
              stats.counts.unresolvedFeedback > 0
                ? "var(--colors-semantic-warning-fill)"
                : undefined
            }
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={t("admin:dashboard_history_pending")}
            value={stats.counts.historyOutboxPending}
            icon={<HistoryIcon />}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <StatCard
            label={t("admin:dashboard_history_failed")}
            value={stats.counts.historyOutboxFailed}
            icon={<HistoryIcon />}
            color={
              stats.counts.historyOutboxFailed > 0
                ? "var(--colors-semantic-error-fill)"
                : undefined
            }
          />
        </div>

        <div className="col-span-12">
          <DashboardOperationsSummary summary={dashboardSummary} />
        </div>

        <div className="col-span-12">
          <Card>
            <CardContent>
              <h3 className="text-sm font-extrabold mb-2">
                {t("admin:dashboard_content_created_30d")}
              </h3>
              <div style={{ height: 320 }}>
                <ContentTrendChart trend={stats.contentTrend} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
