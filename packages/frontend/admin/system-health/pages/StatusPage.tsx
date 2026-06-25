import type { SystemStatusSummary } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import {
  Activity,
  ArrowRight,
  Database as CdcIcon,
  History,
  ListChecks,
  RefreshCw,
  Search,
  Server,
} from "lucide-react";
import type React from "react";
import { Page } from "@/admin/core/layouts/Page";
import { Link } from "@/admin/shared/ui/link";
import { StatusIndicator } from "../components/StatusIndicator";
import { ServiceLinksPanel } from "../components/StatusPanels";
import { useAdminSystemStatusQuery } from "../hooks/useAdminStatusQueries";
import {
  describeStatusState,
  formatCheckedAt,
  formatStatusState,
  type StatusState,
  worstStatusState,
} from "../models/status";

// The overview deliberately does NOT render the heavy panels (services table,
// job-queue table, full Meili summary). It shows the overall-state banner,
// service links, and summary cards that *link down* to the focused sub-pages —
// the Meili card links to `/meili/observability` rather than rebuilding the
// Meili panel, which already lives there.
// 概览页刻意不渲染重型面板（服务表、任务队列表、完整 Meili 摘要）。它只展示
// 整体状态横幅、服务链接，以及向下链接到聚焦子页面的摘要卡片——
// Meili 卡片链接到 `/meili/observability`，而非重建已存在于那里的 Meili 面板。
function SummaryCard({
  title,
  status,
  to,
  icon,
  children,
}: {
  title: string;
  status: StatusState;
  to: string;
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
          <StatusIndicator status={status} compact />
        </div>
        <div className="grid gap-1 text-sm leading-[1.4] text-text-secondary">
          {children}
        </div>
        <Link
          to={to}
          className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-text-secondary no-underline hover:text-text-primary"
        >
          查看詳情
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function StatusSummaryCards({ summary }: { summary: SystemStatusSummary }) {
  const { t } = getI18nRuntime().i18n;
  const servicesState = worstStatusState([
    ...summary.services.map((item) => item.status),
    ...summary.databases.map((item) => item.status),
    summary.sequin.status,
  ]);
  const queueFailed = summary.queue.failedJobs.length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryCard
        title={t("admin:status_services_title")}
        status={servicesState}
        to="/status/services"
        icon={<Server className="size-4" aria-hidden="true" />}
      >
        <p>
          服務 {summary.services.length} · 資料庫 {summary.databases.length}
        </p>
      </SummaryCard>

      <SummaryCard
        title={t("admin:status_queue_title")}
        status={summary.queue.item.status}
        to="/status/queue"
        icon={<ListChecks className="size-4" aria-hidden="true" />}
      >
        <p>
          lanes {summary.queue.counts.length} · 失敗工作 {queueFailed}
        </p>
      </SummaryCard>

      <SummaryCard
        title={t("admin:status_cdc_title")}
        status={summary.cdc.item.status}
        to="/status/cdc"
        icon={<CdcIcon className="size-4" aria-hidden="true" />}
      >
        <p>
          publication {summary.cdc.publicationName ?? "未設定"} · 缺表{" "}
          {summary.cdc.missingTables.length}
        </p>
      </SummaryCard>

      <SummaryCard
        title={t("admin:status_history_title")}
        status={summary.historyOutbox.item.status}
        to="/status/history"
        icon={<History className="size-4" aria-hidden="true" />}
      >
        <p>
          pending {summary.historyOutbox.pending} · failed{" "}
          {summary.historyOutbox.failed}
        </p>
      </SummaryCard>

      <SummaryCard
        title={t("admin:nav_meili")}
        status={summary.meili.status}
        to="/meili/observability"
        icon={<Search className="size-4" aria-hidden="true" />}
      >
        <p>
          index {summary.meili.indexes.length} · schema{" "}
          {summary.meili.schemas.length}
        </p>
      </SummaryCard>
    </div>
  );
}

export function StatusPage() {
  const { t } = getI18nRuntime().i18n;
  const query = useAdminSystemStatusQuery();
  const summary = query.data;

  return (
    <Page
      title={t("admin:status_overview_title")}
      description={
        summary
          ? `${formatStatusState(summary.status)}：${describeStatusState(summary.status)}。最後檢查 ${formatCheckedAt(summary.checkedAt)}`
          : t("admin:status_overview_description")
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          重新整理
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-border-whisper bg-surface-base p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Activity
              className="size-4 text-text-secondary"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold leading-[1.4]">整體狀態</p>
            <StatusIndicator status={summary?.status ?? "unknown"} />
          </div>
          <p className="mt-2 text-sm leading-[1.4] text-text-secondary">
            {summary
              ? describeStatusState(summary.status)
              : query.isError
                ? "無法讀取狀態資料。"
                : "正在讀取狀態資料。"}
          </p>
        </div>
        {summary ? (
          <>
            <ServiceLinksPanel links={summary.links} />
            <StatusSummaryCards summary={summary} />
          </>
        ) : null}
      </div>
    </Page>
  );
}
