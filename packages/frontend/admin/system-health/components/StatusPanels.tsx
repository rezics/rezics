import type {
  CdcSourceStatus,
  CdcStatus,
  HistoryOutboxStatus,
  MeiliIndexStatus,
  MeiliStatusSummary,
  QueueStatus,
  StatusItem,
  StatusLink,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AppWindow,
  ArrowRight,
  Cpu,
  Database,
  ExternalLink,
  History,
  ListChecks,
  Search,
  Wrench,
} from "lucide-react";
import type React from "react";
import { AdminSafeLink } from "@/admin/shared/ui/link";
import {
  formatCheckedAt,
  getMeiliDriftCount,
  type StatusState,
  statusBorderClass,
  statusTextClass,
} from "../models/status";
import { StatusIndicator } from "./StatusIndicator";

function repairSearch({
  scope,
  targetIds,
  historyOutboxStatuses,
  unitId,
  olderThanMinutes,
  limit,
  reason,
}: {
  scope:
    | "search"
    | "cdc"
    | "slug"
    | "queue-failed-job"
    | "history-outbox-replay"
    | "attribution"
    | "counters";
  targetIds?: string;
  historyOutboxStatuses?: ("pending" | "failed")[];
  unitId?: string;
  olderThanMinutes?: number;
  limit?: number;
  reason?: string;
}) {
  return {
    scope,
    targetIds,
    historyOutboxStatuses,
    unitId,
    olderThanMinutes,
    limit,
    reason,
  };
}

function SectionState({
  isLoading,
  isError,
  empty,
}: {
  isLoading?: boolean;
  isError?: boolean;
  empty?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Spinner size="sm" />
        <span>載入狀態資料中</span>
      </div>
    );
  }
  if (isError) {
    return (
      <Alert>
        <AlertDescription className="text-error-text">
          無法讀取這段狀態資料，請確認目前帳號權限與 Server 連線。
        </AlertDescription>
      </Alert>
    );
  }
  if (empty) {
    return (
      <p className="text-sm text-text-secondary">尚無可顯示的狀態資料。</p>
    );
  }
  return null;
}

function StatusItemRow({ item }: { item: StatusItem }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-medium leading-[1.4]">
            {item.label}
          </p>
          <StatusIndicator status={item.status} />
        </div>
        {item.reason ? (
          <p className="mt-1 break-words text-xs leading-[1.4] text-text-secondary">
            {item.reason}
          </p>
        ) : null}
        {item.remediation ? (
          <p className="mt-1 break-words text-xs leading-[1.4] text-text-tertiary">
            建議：{item.remediation}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-xs text-text-tertiary">
        {formatCheckedAt(item.checkedAt)}
      </div>
    </div>
  );
}

function StatusCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card surface="contained" size="sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-text-secondary">{icon}</span>
          <div className="min-w-0">
            <CardTitle className="text-base leading-[1.4]">{title}</CardTitle>
            {description ? (
              <CardDescription className="leading-[1.4]">
                {description}
              </CardDescription>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">{children}</CardContent>
    </Card>
  );
}

/**
 * 服務連結是操作員的 quick links，不再做卡片內套卡片；每個入口是同一個
 * contained 面板中的無邊框 row，URL 在窄寬兩端都截斷。
 *
 * Mobile
 * +------------------------------+
 * | Link row                     |
 * | Link row                     |
 * | Link row                     |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------+
 * | Link row      | Link row     |
 * | Link row      | Link row     |
 * +------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | Link row      | Link row      | Link row       |
 * | Link row      | Link row      | Link row       |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------------------+
 * | Parent shell centers; links keep three columns  |
 * +------------------------------------------------+
 */
export function ServiceLinksPanel({ links }: { links: StatusLink[] }) {
  const { t } = useTranslation(["admin"]);

  return (
    <StatusCard
      title={t("admin:status_links_title")}
      description={t("admin:status_links_description")}
      icon={<ExternalLink className="size-4" aria-hidden="true" />}
    >
      {links.length === 0 ? (
        <SectionState empty />
      ) : (
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="min-w-0 rounded-sm p-3 transition-colors hover:bg-surface-sunken"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium leading-[1.4]">
                  {link.label}
                </p>
                <StatusIndicator status={link.status} compact />
              </div>
              {link.url ? (
                <AdminSafeLink
                  href={link.url}
                  className="mt-2 block truncate text-xs text-link"
                >
                  {link.url}
                </AdminSafeLink>
              ) : (
                <p className="mt-2 text-xs text-text-secondary">
                  {link.reason ?? "未設定"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </StatusCard>
  );
}

/**
 * 服務頁按運維邊界分組，不把所有檢查壓成單列；每組內部用分隔線列表，
 * 讓一屏內可掃描 app、worker、data、external 四類狀態。
 *
 * Mobile
 * +------------------------------+
 * | App / API rows               |
 * | Worker rows                  |
 * | Data rows                    |
 * | External rows                |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------+
 * | App / API rows               |
 * | Worker rows                  |
 * | Data rows                    |
 * | External rows                |
 * +------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | App / API rows       | Worker rows             |
 * | Data rows            | External rows           |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------------------+
 * | Parent shell centers; two-column groups remain  |
 * +------------------------------------------------+
 */
export function ServicesPanel({
  services,
  databases,
  sequin,
}: {
  services: StatusItem[];
  databases: StatusItem[];
  sequin: StatusItem;
}) {
  const { t } = useTranslation(["admin"]);
  const serviceById = new Map(services.map((item) => [item.id, item]));
  const knownServiceIds = new Set([
    "app",
    "server",
    "auth",
    "job-runner-health",
    "job-runner-ready",
    "meili",
    sequin.id,
  ]);
  const pickServices = (ids: string[]) =>
    ids
      .map((id) => serviceById.get(id))
      .filter((item): item is StatusItem => Boolean(item));
  const uncategorized = services.filter(
    (item) => !knownServiceIds.has(item.id),
  );
  const groups = [
    {
      id: "app",
      title: t("admin:status_services_group_app"),
      icon: <AppWindow className="size-4" aria-hidden="true" />,
      items: pickServices(["app", "server", "auth"]),
    },
    {
      id: "worker",
      title: t("admin:status_services_group_worker"),
      icon: <Cpu className="size-4" aria-hidden="true" />,
      items: pickServices(["job-runner-health", "job-runner-ready"]),
    },
    {
      id: "data",
      title: t("admin:status_services_group_data"),
      icon: <Database className="size-4" aria-hidden="true" />,
      items: [...pickServices(["meili"]), ...databases],
    },
    {
      id: "external",
      title: t("admin:status_services_group_external"),
      icon: <ExternalLink className="size-4" aria-hidden="true" />,
      items: [sequin, ...uncategorized],
    },
  ].filter((group) => group.items.length > 0);

  return (
    <StatusCard
      title={t("admin:status_services_title")}
      description={t("admin:status_services_description")}
      icon={<Activity className="size-4" aria-hidden="true" />}
    >
      {groups.length === 0 ? (
        <SectionState empty />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => (
            <Card
              key={group.id}
              surface="plain"
              size="sm"
              className="h-full gap-0 py-0"
            >
              <CardHeader className="px-0 pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-text-secondary">
                    {group.icon}
                  </span>
                  <CardTitle className="min-w-0 truncate text-sm leading-[1.4]">
                    {group.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-0">
                <div className="divide-y divide-border-whisper">
                  {group.items.map((item) => (
                    <StatusItemRow key={item.id} item={item} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </StatusCard>
  );
}

function latestTaskForIndex(
  tasks: MeiliStatusSummary["tasks"],
  indexUid: string,
) {
  return tasks.find((task) => task.indexUid === indexUid) ?? null;
}

function formatTaskTime(task: MeiliStatusSummary["tasks"][number]) {
  return (
    task.finishedAt ??
    task.startedAt ??
    task.enqueuedAt ??
    task.duration ??
    "未回報"
  );
}

function MeiliIndexRow({
  index,
  latestTask,
}: {
  index: MeiliIndexStatus;
  latestTask: MeiliStatusSummary["tasks"][number] | null;
}) {
  const drift = index.settingsDrift;
  const driftLabels = [
    drift?.primaryKey && !drift.primaryKey.matches ? "primary key" : null,
    drift?.searchableAttributes.missing.length ||
    drift?.searchableAttributes.extra.length
      ? "searchable"
      : null,
    drift?.filterableAttributes.missing.length ||
    drift?.filterableAttributes.extra.length
      ? "filterable"
      : null,
    drift?.sortableAttributes.missing.length ||
    drift?.sortableAttributes.extra.length
      ? "sortable"
      : null,
  ].filter(Boolean);

  return (
    <div
      className={`rounded-md border bg-surface-subtle p-3 ${statusBorderClass(index.status)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium leading-[1.4]">{index.label}</p>
          <p className="text-xs text-text-secondary">{index.uid}</p>
        </div>
        <StatusIndicator status={index.status} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-text-secondary sm:grid-cols-3">
        <span>文件：{index.numberOfDocuments ?? "未回報"}</span>
        <span>
          Primary key：{index.primaryKey ?? index.expected.primaryKey}
        </span>
        <span>索引中：{index.isIndexing ? "是" : "否"}</span>
        <span>searchable：{index.expected.searchableAttributes.length}</span>
        <span>filterable：{index.expected.filterableAttributes.length}</span>
        <span>sortable：{index.expected.sortableAttributes.length}</span>
      </div>
      {latestTask ? (
        <p className="mt-2 text-xs leading-[1.4] text-text-secondary">
          最近任務：#{latestTask.uid} · {latestTask.type ?? "unknown"} ·{" "}
          {latestTask.status ?? "unknown"} · {formatTaskTime(latestTask)}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-[1.4] text-text-tertiary">
          最近任務：未回報
        </p>
      )}
      {drift?.hasDrift ? (
        <p className="mt-2 text-xs leading-[1.4] text-warning-text">
          設定漂移：{driftLabels.join("、") || "已偵測到差異"}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-[1.4] text-success-text">
          設定與預期 schema 相符
        </p>
      )}
      <div className="mt-3">
        <Link
          to="/repair"
          search={repairSearch({ scope: "search" })}
          className={buttonVariants({ variant: "outline", size: "xs" })}
        >
          <Wrench className="size-3" aria-hidden="true" />
          開啟修復
        </Link>
      </div>
    </div>
  );
}

export function MeiliSummaryPanel({ meili }: { meili: MeiliStatusSummary }) {
  const failedTasks = meili.tasks.filter((task) => task.status === "failed");
  const driftCount = getMeiliDriftCount(meili.indexes);

  return (
    <StatusCard
      title="Meilisearch 摘要"
      description="讀取預期 schema、live index 統計、settings drift 與最近任務。"
      icon={<Search className="size-4" aria-hidden="true" />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusIndicator status={meili.status} />
        <span className="text-xs text-text-secondary">
          schema {meili.schemas.length} 個 · index {meili.indexes.length} 個 ·
          drift {driftCount} 個 · 失敗任務 {failedTasks.length} 個
        </span>
        <Link
          to="/meili/observability"
          className={buttonVariants({ variant: "outline", size: "xs" })}
        >
          完整 Meili 觀測
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
      {meili.reason ? (
        <p className="text-xs leading-[1.4] text-text-secondary">
          {meili.reason}
        </p>
      ) : null}
      <div className="grid gap-2">
        {meili.indexes.map((index) => (
          <MeiliIndexRow
            key={index.uid}
            index={index}
            latestTask={latestTaskForIndex(meili.tasks, index.uid)}
          />
        ))}
      </div>
      {meili.tasks.length === 0 ? (
        <p className="text-sm text-text-secondary">目前沒有最近任務資料。</p>
      ) : (
        <div className="space-y-2">
          <Separator />
          <p className="text-sm font-medium leading-[1.4]">最近任務</p>
          <div className="grid gap-2">
            {meili.tasks.slice(0, 6).map((task) => {
              const state: StatusState =
                task.status === "failed"
                  ? "degraded"
                  : task.status === "succeeded"
                    ? "available"
                    : "unknown";
              return (
                <div
                  key={`${task.uid}-${task.indexUid ?? "global"}`}
                  className="rounded-md border border-border-whisper bg-surface-subtle p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium leading-[1.4]">
                      #{task.uid} · {task.type ?? "unknown"}
                    </p>
                    <StatusIndicator status={state} />
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    index：{task.indexUid ?? "全域"} · Meili 狀態：
                    {task.status ?? "未知"}
                  </p>
                  {task.errorCode || task.errorMessage ? (
                    <p className="mt-1 text-xs text-error-text">
                      {task.errorCode ?? "error"} {task.errorMessage ?? ""}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </StatusCard>
  );
}

function formatBooleanState(value: boolean | null | undefined) {
  if (value === true) return "是";
  if (value === false) return "否";
  return "未回報";
}

function MetricGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: React.ReactNode;
    state?: StatusState;
  }>;
}) {
  return (
    <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-sm bg-surface-subtle p-3 leading-[1.4]"
        >
          <p className="text-text-tertiary">{item.label}</p>
          <p
            className={`mt-1 break-words font-medium ${
              item.state ? statusTextClass(item.state) : "text-text-primary"
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function TableDriftList({
  title,
  tables,
  state,
}: {
  title: string;
  tables: string[];
  state: StatusState;
}) {
  if (tables.length === 0) return null;
  return (
    <div className="rounded-sm border border-border-whisper bg-surface-subtle p-3">
      <p
        className={`text-sm font-medium leading-[1.4] ${statusTextClass(state)}`}
      >
        {title}
      </p>
      <p className="mt-1 break-words text-xs leading-[1.4] text-text-secondary">
        {tables.join("、")}
      </p>
    </div>
  );
}

function queueTotals(queue: QueueStatus) {
  return queue.counts.reduce(
    (acc, count) => ({
      created: acc.created + count.created,
      retry: acc.retry + count.retry,
      active: acc.active + count.active,
      failed: acc.failed + count.failed,
      all: acc.all + count.all,
    }),
    { created: 0, retry: 0, active: 0, failed: 0, all: 0 },
  );
}

function cdcSourceRepairTargets(source: CdcSourceStatus) {
  const targets = source.detectedIssues.map(
    (issue) => `${issue.sourceId}:${issue.code}`,
  );
  return targets.length ? targets.join(",") : undefined;
}

function CdcSourceBlock({
  source,
  t,
}: {
  source: CdcSourceStatus;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  const hasPublicationDrift =
    source.missingTables.length > 0 || (source.extraTables?.length ?? 0) > 0;
  const repairTargets = cdcSourceRepairTargets(source);
  return (
    <div className="flex min-w-0 flex-col rounded-md border border-border-defined bg-surface-base p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-[1.4]">{source.label}</p>
          <p className="mt-1 break-all text-xs text-text-secondary">
            {source.publicationName ?? t("admin:status_value_not_configured")} ·{" "}
            {source.slotName ?? t("admin:status_value_not_configured")}
          </p>
        </div>
        <StatusIndicator status={source.item.status} />
      </div>
      {source.item.reason ? (
        <p className="mt-2 text-xs leading-[1.4] text-text-secondary">
          {source.item.reason}
        </p>
      ) : null}
      <MetricGrid
        items={[
          {
            label: t("admin:status_cdc_metric_wal_level"),
            value: source.walLevel ?? t("admin:status_value_unknown"),
          },
          {
            label: t("admin:status_cdc_metric_publication_exists"),
            value: formatBooleanState(source.publicationExists),
            state: source.publicationExists === false ? "degraded" : undefined,
          },
          {
            label: t("admin:status_cdc_metric_slot_active"),
            value: `${formatBooleanState(source.slotActive)}${
              source.slotActivePid ? ` · pid ${source.slotActivePid}` : ""
            }`,
            state: source.slotActive === false ? "degraded" : undefined,
          },
          {
            label: t("admin:status_cdc_metric_lag_bytes"),
            value: source.lagBytes ?? t("admin:status_value_unknown"),
            state:
              source.lagBytes && source.lagBytes > 0 ? "degraded" : undefined,
          },
          {
            label: t("admin:status_cdc_metric_replication_slots"),
            value:
              source.maxReplicationSlots == null
                ? t("admin:status_value_unknown")
                : t("admin:status_cdc_metric_capacity", {
                    used: source.usedReplicationSlots ?? 0,
                    max: source.maxReplicationSlots,
                    available: source.availableReplicationSlots ?? 0,
                  }),
            state:
              source.availableReplicationSlots === 0 ? "degraded" : undefined,
          },
          {
            label: t("admin:status_cdc_metric_wal_senders"),
            value:
              source.maxWalSenders == null
                ? t("admin:status_value_unknown")
                : t("admin:status_cdc_metric_wal_sender_capacity", {
                    active: source.activeWalSenders ?? 0,
                    max: source.maxWalSenders,
                    available: source.availableWalSenders ?? 0,
                  }),
            state: source.availableWalSenders === 0 ? "degraded" : undefined,
          },
        ]}
      />
      <TableDriftList
        title={t("admin:status_cdc_missing_tables")}
        tables={source.missingTables}
        state="degraded"
      />
      <TableDriftList
        title={t("admin:status_cdc_extra_tables")}
        tables={source.extraTables ?? []}
        state="unknown"
      />
      {!hasPublicationDrift && source.item.status === "available" ? (
        <p className="mt-2 text-xs leading-[1.4] text-success-text">
          {t("admin:status_cdc_source_schema_ok")}
        </p>
      ) : null}
      {source.detectedIssues.length > 0 ? (
        <div className="mt-3 space-y-2">
          {source.detectedIssues.map((issue) => (
            <div
              key={`${issue.sourceId}-${issue.code}`}
              className="rounded-sm border border-warning-border bg-warning-surface p-2"
            >
              <p className="text-xs font-medium text-warning-text">
                {issue.code}
              </p>
              <p className="mt-1 text-xs leading-[1.4] text-warning-text">
                {issue.message}
              </p>
              {issue.remediation ? (
                <p className="mt-1 text-xs leading-[1.4] text-warning-text">
                  {issue.remediation}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {repairTargets ? (
        <Link
          to="/repair"
          search={repairSearch({
            scope: "cdc",
            targetIds: repairTargets,
          })}
          className={`${buttonVariants({
            variant: "outline",
            size: "xs",
          })} mt-3 w-fit`}
        >
          <Wrench className="size-3" aria-hidden="true" />
          {t("admin:repair_open")}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * CDC 狀態頁的主要運維面板。設計意圖是先呈現整條鏈路，再把 main source
 * 與 reaction source 拆成兩張同等權重的狀態卡；每張卡只提供自己的修復入口。
 *
 * Mobile
 * +------------------------------+
 * | Chain rows                   |
 * | Metrics                      |
 * | Source CDC card              |
 * | Reaction CDC card            |
 * | History replay warning       |
 * | Infra note                   |
 * +------------------------------+
 *
 * Tablet
 * +------------------------------+
 * | Chain rows 2 columns         |
 * | Metrics grid                 |
 * | Source CDC card              |
 * | Reaction CDC card            |
 * +------------------------------+
 *
 * Desktop
 * +------------------------------------------------+
 * | Chain rows 2 columns                           |
 * | Metrics grid                                   |
 * | Source CDC card      | Reaction CDC card       |
 * | History / infra notes full width               |
 * +------------------------------------------------+
 *
 * Ultra-wide
 * +------------------------------------------------+
 * | Centered shell from parent, same two-card grid  |
 * | Source and reaction cards keep equal width      |
 * +------------------------------------------------+
 */
export function CdcPanel({
  cdc,
  historyOutbox,
  queue,
  sequin,
}: {
  cdc: CdcStatus;
  historyOutbox: HistoryOutboxStatus;
  queue: QueueStatus;
  sequin: StatusItem;
}) {
  const { t } = useTranslation(["admin"]);
  const totals = queueTotals(queue);
  return (
    <StatusCard
      title={t("admin:status_cdc_chain_title")}
      description={t("admin:status_cdc_chain_description")}
      icon={<Database className="size-4" aria-hidden="true" />}
    >
      <div className="grid gap-2 lg:grid-cols-2">
        <StatusItemRow item={cdc.item} />
        <StatusItemRow item={sequin} />
        <StatusItemRow item={queue.item} />
        <StatusItemRow item={historyOutbox.item} />
      </div>
      <MetricGrid
        items={[
          {
            label: t("admin:status_cdc_metric_sources"),
            value: cdc.sources.length,
          },
          {
            label: t("admin:status_cdc_metric_detected_issues"),
            value: cdc.detectedIssues.length,
            state: cdc.detectedIssues.length > 0 ? "degraded" : undefined,
          },
          {
            label: t("admin:status_cdc_metric_history_pending"),
            value: t("admin:status_cdc_metric_history_pending_value", {
              pending: historyOutbox.pending,
              retryReady: historyOutbox.retryReady,
            }),
            state:
              historyOutbox.pendingWithoutIngestJob || historyOutbox.failed > 0
                ? "degraded"
                : undefined,
          },
          {
            label: t("admin:status_cdc_metric_job_runner_queue"),
            value: t("admin:status_cdc_metric_job_runner_queue_value", {
              active: totals.active,
              retry: totals.retry,
              failed: totals.failed,
            }),
            state: totals.failed > 0 ? "degraded" : undefined,
          },
        ]}
      />
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        {cdc.sources.map((source) => (
          <CdcSourceBlock key={source.id} source={source} t={t} />
        ))}
      </div>
      {cdc.detectedIssues.length > 0 ? (
        <div className="rounded-sm border border-warning-border bg-warning-surface p-3">
          <p className="text-sm font-medium leading-[1.4] text-warning-text">
            {t("admin:status_cdc_detected_title")}
          </p>
          <p className="mt-1 text-xs leading-[1.4] text-warning-text">
            {t("admin:status_cdc_detected_description")}
          </p>
        </div>
      ) : null}
      {historyOutbox.pendingWithoutIngestJob ? (
        <div className="rounded-sm border border-warning-border bg-warning-surface p-3">
          <p className="text-sm font-medium leading-[1.4] text-warning-text">
            {t("admin:status_cdc_history_pending_title")}
          </p>
          <p className="mt-1 text-xs leading-[1.4] text-warning-text">
            {t("admin:status_cdc_history_pending_description")}
          </p>
          <Link
            to="/repair"
            search={repairSearch({
              scope: "history-outbox-replay",
              historyOutboxStatuses: ["pending", "failed"],
              olderThanMinutes: 5,
              limit: 50,
            })}
            className={`${buttonVariants({
              variant: "outline",
              size: "xs",
            })} mt-3`}
          >
            <Wrench className="size-3" aria-hidden="true" />
            {t("admin:repair_open")}
          </Link>
        </div>
      ) : null}
      <div className="rounded-sm border border-border-whisper bg-surface-subtle p-3">
        <p className="text-sm font-medium leading-[1.4]">
          {t("admin:status_cdc_infra_title")}
        </p>
        <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
          {t("admin:status_cdc_infra_description")}
        </p>
        {sequin.url ? (
          <AdminSafeLink
            href={sequin.url}
            className="mt-2 inline-block text-xs text-link"
          >
            {t("admin:status_cdc_open_sequin")}
          </AdminSafeLink>
        ) : null}
      </div>
    </StatusCard>
  );
}

export function HistoryOutboxPanel({
  historyOutbox,
}: {
  historyOutbox: HistoryOutboxStatus;
}) {
  return (
    <StatusCard
      title="History outbox"
      description="歷史同步 outbox 的 pending、failed 與 retry-ready 狀態。"
      icon={<History className="size-4" aria-hidden="true" />}
    >
      <StatusItemRow item={historyOutbox.item} />
      <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-4">
        <span>pending：{historyOutbox.pending}</span>
        <span>processing：{historyOutbox.processing}</span>
        <span
          className={
            historyOutbox.failed > 0 ? statusTextClass("degraded") : ""
          }
        >
          failed：{historyOutbox.failed}
        </span>
        <span>retry-ready：{historyOutbox.retryReady}</span>
      </div>
      {historyOutbox.recentFailed.length > 0 ? (
        <div className="space-y-2">
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium leading-[1.4]">最近失敗 outbox</p>
            <Link
              to="/repair"
              search={repairSearch({
                scope: "history-outbox-replay",
                historyOutboxStatuses: ["failed"],
                olderThanMinutes: 0,
                limit: 50,
              })}
              className={buttonVariants({ variant: "outline", size: "xs" })}
            >
              <Wrench className="size-3" aria-hidden="true" />
              開啟修復
            </Link>
          </div>
          {historyOutbox.recentFailed.slice(0, 5).map((row) => (
            <div
              key={row.id}
              className="rounded-md border border-border-whisper bg-surface-subtle p-3 text-xs"
            >
              <p className="font-medium leading-[1.4]">
                {row.category} · seq {row.sequence}
              </p>
              <p className="mt-1 text-text-secondary">
                unit：{row.unitId} · attempts：{row.attempts} · next：
                {formatCheckedAt(row.nextAttemptAt)}
              </p>
              {row.lastError ? (
                <p className="mt-1 line-clamp-2 text-error-text">
                  {row.lastError}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-success-text">
          目前沒有 failed HistoryOutbox rows。
        </p>
      )}
    </StatusCard>
  );
}

export function QueuePanel({ queue }: { queue: QueueStatus }) {
  const totals = queue.counts.reduce(
    (acc, count) => ({
      created: acc.created + count.created,
      retry: acc.retry + count.retry,
      active: acc.active + count.active,
      completed: acc.completed + count.completed,
      cancelled: acc.cancelled + count.cancelled,
      failed: acc.failed + count.failed,
      all: acc.all + count.all,
    }),
    {
      created: 0,
      retry: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
      failed: 0,
      all: 0,
    },
  );

  return (
    <StatusCard
      title="Job-runner 佇列"
      description="顯示 lane 狀態計數與失敗工作摘要。"
      icon={<ListChecks className="size-4" aria-hidden="true" />}
    >
      <StatusItemRow item={queue.item} />
      <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-4">
        <span>active：{totals.active}</span>
        <span>retry：{totals.retry}</span>
        <span className={totals.failed > 0 ? statusTextClass("degraded") : ""}>
          failed：{totals.failed}
        </span>
        <span>all：{totals.all}</span>
      </div>
      {queue.counts.length === 0 ? (
        <SectionState empty />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-border-whisper text-text-secondary">
              <tr>
                <th className="py-2 pr-3">Lane</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Retry</th>
                <th className="py-2 pr-3">Active</th>
                <th className="py-2 pr-3">Failed</th>
                <th className="py-2 pr-3">Completed</th>
                <th className="py-2 pr-3">Cancelled</th>
                <th className="py-2 pr-3">All</th>
              </tr>
            </thead>
            <tbody>
              {queue.counts.map((count) => (
                <tr key={count.lane} className="border-b border-border-whisper">
                  <td className="py-2 pr-3 font-medium">{count.lane}</td>
                  <td className="py-2 pr-3">{count.created}</td>
                  <td className="py-2 pr-3">{count.retry}</td>
                  <td className="py-2 pr-3">{count.active}</td>
                  <td
                    className={`py-2 pr-3 ${count.failed > 0 ? statusTextClass("degraded") : ""}`}
                  >
                    {count.failed}
                  </td>
                  <td className="py-2 pr-3">{count.completed}</td>
                  <td className="py-2 pr-3">{count.cancelled}</td>
                  <td className="py-2 pr-3">{count.all}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {queue.failedJobs.length > 0 ? (
        <div className="space-y-2">
          <Separator />
          <p className="text-sm font-medium leading-[1.4]">失敗工作</p>
          {queue.failedJobs.slice(0, 5).map((job) => (
            <div
              key={`${job.lane ?? "lane"}-${job.id ?? "job"}`}
              className="rounded-md border border-border-whisper bg-surface-subtle p-3 text-xs"
            >
              <p className="font-medium leading-[1.4]">
                {job.lane ?? "unknown"} · {job.commandKind ?? "unknown"}
              </p>
              <p className="mt-1 text-text-secondary">
                id：{job.id ?? "未回報"} · state：{job.state ?? "unknown"} ·
                attempts：{job.attemptCount}
              </p>
              <p className="mt-1 text-text-secondary">
                command lane：{job.commandLane ?? "unknown"} · created：
                {formatCheckedAt(job.createdAt)}
              </p>
              {job.source && typeof job.source === "object" ? (
                <p className="mt-1 truncate text-text-tertiary">
                  source：
                  {Object.entries(job.source as Record<string, unknown>)
                    .map(([key, value]) => `${key}:${String(value)}`)
                    .join(" · ")}
                </p>
              ) : null}
              {job.id && job.lane ? (
                <Link
                  to="/repair"
                  search={repairSearch({
                    scope: "queue-failed-job",
                    targetIds: `${job.lane}:${job.id}`,
                  })}
                  className={`${buttonVariants({
                    variant: "outline",
                    size: "xs",
                  })} mt-3`}
                >
                  <Wrench className="size-3" aria-hidden="true" />
                  開啟修復
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </StatusCard>
  );
}
