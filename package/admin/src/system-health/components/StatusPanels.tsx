import type {
  CdcStatus,
  HistoryOutboxStatus,
  MeiliIndexStatus,
  MeiliStatusSummary,
  QueueStatus,
  StatusItem,
  StatusLink,
} from "@rezics/api";
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
  ArrowRight,
  Database,
  ExternalLink,
  History,
  ListChecks,
  Search,
  Wrench,
} from "lucide-react";
import type React from "react";
import { AdminSafeLink } from "@/shared/ui/link";
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
    <div className="flex flex-col gap-2 rounded-md border border-border-whisper bg-surface-subtle p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium leading-[1.4]">{item.label}</p>
          <StatusIndicator status={item.status} />
        </div>
        {item.reason ? (
          <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
            {item.reason}
          </p>
        ) : null}
        {item.remediation ? (
          <p className="mt-1 text-xs leading-[1.4] text-text-tertiary">
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
    <Card className="border-border-whisper bg-surface-base">
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

export function ServiceLinksPanel({ links }: { links: StatusLink[] }) {
  return (
    <StatusCard
      title="服務連結"
      description="只顯示已設定的非秘密服務 URL。"
      icon={<ExternalLink className="size-4" aria-hidden="true" />}
    >
      {links.length === 0 ? (
        <SectionState empty />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="rounded-md border border-border-whisper bg-surface-subtle p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium leading-[1.4]">
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

export function ServicesPanel({
  services,
  databases,
  sequin,
}: {
  services: StatusItem[];
  databases: StatusItem[];
  sequin: StatusItem;
}) {
  const items = [
    ...services.filter((item) => item.id !== sequin.id),
    ...databases,
    sequin,
  ];
  return (
    <StatusCard
      title="服務與資料庫"
      description="Server 端聚合服務健康狀態，瀏覽器不直接呼叫私有依賴。"
      icon={<Activity className="size-4" aria-hidden="true" />}
    >
      {items.length === 0 ? (
        <SectionState empty />
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <StatusItemRow key={item.id} item={item} />
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
  const totals = queueTotals(queue);
  const hasPublicationDrift =
    cdc.missingTables.length > 0 || (cdc.extraTables?.length ?? 0) > 0;
  return (
    <StatusCard
      title="Sequin / CDC / Database"
      description="來源資料庫、Sequin、job-runner 與 HistoryOutbox 的 CDC 鏈路狀態。"
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
          { label: "wal_level", value: cdc.walLevel ?? "未回報" },
          {
            label: "publication",
            value: cdc.publicationName ?? "未設定",
            state: cdc.publicationExists === false ? "degraded" : undefined,
          },
          {
            label: "publication exists",
            value: formatBooleanState(cdc.publicationExists),
            state: cdc.publicationExists === false ? "degraded" : undefined,
          },
          {
            label: "slot",
            value: cdc.slotName ?? "未設定",
            state: cdc.slotExists === false ? "degraded" : undefined,
          },
          {
            label: "slot active",
            value: `${formatBooleanState(cdc.slotActive)}${
              cdc.slotActivePid ? ` · pid ${cdc.slotActivePid}` : ""
            }`,
            state: cdc.slotActive === false ? "degraded" : undefined,
          },
          {
            label: "lag bytes",
            value: cdc.lagBytes ?? "未回報",
            state: cdc.lagBytes && cdc.lagBytes > 0 ? "degraded" : undefined,
          },
          { label: "restart LSN", value: cdc.restartLsn ?? "未回報" },
          {
            label: "confirmed flush LSN",
            value: cdc.confirmedFlushLsn ?? "未回報",
          },
          {
            label: "replication slots",
            value:
              cdc.maxReplicationSlots == null
                ? "未回報"
                : `${cdc.usedReplicationSlots ?? 0}/${cdc.maxReplicationSlots} used · ${cdc.availableReplicationSlots ?? 0} available`,
            state: cdc.availableReplicationSlots === 0 ? "degraded" : undefined,
          },
          {
            label: "WAL senders",
            value:
              cdc.maxWalSenders == null
                ? "未回報"
                : `${cdc.activeWalSenders ?? 0}/${cdc.maxWalSenders} active · ${cdc.availableWalSenders ?? 0} available`,
            state: cdc.availableWalSenders === 0 ? "degraded" : undefined,
          },
          {
            label: "HistoryOutbox pending",
            value: `${historyOutbox.pending} pending · ${historyOutbox.retryReady} retry-ready`,
            state:
              historyOutbox.pendingWithoutIngestJob || historyOutbox.failed > 0
                ? "degraded"
                : undefined,
          },
          {
            label: "job-runner queue",
            value: `${totals.active} active · ${totals.retry} retry · ${totals.failed} failed`,
            state: totals.failed > 0 ? "degraded" : undefined,
          },
        ]}
      />
      <TableDriftList
        title="publication 缺少資料表"
        tables={cdc.missingTables}
        state="degraded"
      />
      <TableDriftList
        title="publication 額外資料表"
        tables={cdc.extraTables ?? []}
        state="unknown"
      />
      {!hasPublicationDrift ? (
        <p className="text-xs leading-[1.4] text-success-text">
          已路由資料表都有 publication 覆蓋，未偵測到額外 publication 資料表。
        </p>
      ) : null}
      {historyOutbox.pendingWithoutIngestJob ? (
        <div className="rounded-sm border border-warning-border bg-warning-surface p-3">
          <p className="text-sm font-medium leading-[1.4] text-warning-text">
            HistoryOutbox pending 但沒有 history.ingest 佇列活動
          </p>
          <p className="mt-1 text-xs leading-[1.4] text-warning-text">
            先確認 Sequin 與 job-runner 入口健康，再到修復頁對 HistoryOutbox
            replay 做 dry-run。
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
            開啟修復
          </Link>
        </div>
      ) : null}
      <div className="rounded-sm border border-border-whisper bg-surface-subtle p-3">
        <p className="text-sm font-medium leading-[1.4]">
          Slot recreation is a deployment operation
        </p>
        <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
          This admin surface only diagnoses CDC state and queues bounded repair
          jobs. Replication slot drop/recreate, active slot termination, and
          Sequin deployment changes stay in runbook-controlled operations.
        </p>
        {sequin.url ? (
          <AdminSafeLink
            href={sequin.url}
            className="mt-2 inline-block text-xs text-link"
          >
            Open Sequin UI
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
