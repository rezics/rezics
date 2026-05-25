import type {
  CdcStatus,
  MeiliStatusSummary,
  QueueStatus,
  StatusItem,
  StatusLink,
} from "@rezics/api";
import { SafeLink } from "@rezics/ui";
import {
  Database,
  ExternalLink,
  GitBranch,
  ListChecks,
  Search,
  Server,
} from "lucide-react";
import { StatusIndicator } from "./StatusIndicator";

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-medium leading-[1.4] text-text-primary">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm leading-[1.55] text-text-secondary">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-md bg-surface-subtle p-4 text-sm leading-[1.55] text-text-secondary">
      {children}
    </div>
  );
}

export function StatusServiceGrid({ services }: { services: StatusItem[] }) {
  if (!services.length) return <EmptyState>目前沒有服務檢查資料。</EmptyState>;

  return (
    <section>
      <SectionTitle
        title="服務健康"
        description="每個項目都由 Server 端聚合，瀏覽器不直接呼叫內部服務。"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.map((item) => (
          <div key={item.id} className="rounded-md bg-surface-elevated p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium leading-[1.4] text-text-primary">
                  <Server aria-hidden="true" className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.reason ? (
                  <p className="mt-2 text-xs leading-[1.4] text-text-secondary">
                    {item.reason}
                  </p>
                ) : null}
              </div>
              <StatusIndicator status={item.status} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StatusLinksPanel({ links }: { links: StatusLink[] }) {
  return (
    <section>
      <SectionTitle
        title="服務連結"
        description="只顯示可安全導覽的非祕密 URL。"
      />
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) =>
          link.url ? (
            <SafeLink
              key={link.id}
              href={link.url}
              className="flex items-center justify-between gap-3 rounded-md bg-surface-elevated px-4 py-3 text-sm leading-[1.4] text-text-primary transition-colors hover:bg-surface-subtle"
            >
              <span className="truncate">{link.label}</span>
              <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0" />
            </SafeLink>
          ) : (
            <div
              key={link.id}
              className="flex items-center justify-between gap-3 rounded-md bg-surface-subtle px-4 py-3 text-sm leading-[1.4] text-text-secondary"
            >
              <span className="truncate">{link.label}</span>
              <span className="text-xs">{link.reason ?? "未設定"}</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

export function MeiliStatusPanel({ meili }: { meili: MeiliStatusSummary }) {
  const missing = meili.indexes.filter((index) => !index.exists).length;
  const drifted = meili.indexes.filter(
    (index) => index.settingsDrift?.hasDrift,
  ).length;
  const failedTasks = meili.tasks.filter((task) => task.status === "failed");

  return (
    <section>
      <SectionTitle
        title="Meilisearch"
        description="預期 schema、索引統計、設定漂移與近期任務。"
      />
      <div className="rounded-md bg-surface-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search aria-hidden="true" className="h-5 w-5 text-text-brand" />
            <div>
              <p className="text-sm font-medium leading-[1.4] text-text-primary">
                Meili 狀態
              </p>
              <p className="text-xs leading-[1.4] text-text-secondary">
                {meili.version ? `版本 ${meili.version}` : "版本未知"}
              </p>
            </div>
          </div>
          <StatusIndicator status={meili.status} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="索引數" value={String(meili.indexes.length)} />
          <Metric label="缺少索引" value={String(missing)} />
          <Metric label="設定漂移" value={String(drifted)} />
        </div>
        {failedTasks.length > 0 ? (
          <div className="mt-4 rounded-md bg-surface-subtle p-3 text-sm leading-[1.55] text-warning-text">
            近期有 {failedTasks.length} 個 Meili 任務失敗。
          </div>
        ) : null}
        <div className="mt-4 divide-y divide-border-whisper">
          {meili.indexes.map((index) => (
            <div
              key={index.uid}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium leading-[1.4] text-text-primary">
                  {index.label}
                </p>
                <p className="text-xs leading-[1.4] text-text-secondary">
                  {index.exists
                    ? `${index.numberOfDocuments ?? 0} docs · ${index.uid}`
                    : `${index.uid} 尚未建立`}
                </p>
              </div>
              <StatusIndicator status={index.status} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-subtle p-3">
      <p className="text-xs leading-[1.3] text-text-secondary">{label}</p>
      <p className="mt-1 text-lg font-medium leading-[1.3] text-text-primary">
        {value}
      </p>
    </div>
  );
}

export function CdcStatusPanel({ cdc }: { cdc: CdcStatus }) {
  return (
    <section>
      <SectionTitle
        title="Sequin / CDC / 資料庫"
        description="Sequin 連線與來源資料庫 CDC 支援狀態分開呈現。"
      />
      <div className="rounded-md bg-surface-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitBranch aria-hidden="true" className="h-5 w-5 text-text-brand" />
            <div>
              <p className="text-sm font-medium leading-[1.4] text-text-primary">
                {cdc.item.label}
              </p>
              <p className="text-xs leading-[1.4] text-text-secondary">
                Publication {cdc.publicationName ?? "未設定"} · Slot{" "}
                {cdc.slotName ?? "未設定"}
              </p>
            </div>
          </div>
          <StatusIndicator status={cdc.item.status} />
        </div>
        {cdc.item.reason ? (
          <p className="mt-3 rounded-md bg-surface-subtle p-3 text-sm leading-[1.55] text-warning-text">
            {cdc.item.reason}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric label="wal_level" value={cdc.walLevel ?? "未知"} />
          <Metric
            label="Publication tables"
            value={String(cdc.publicationTables.length)}
          />
          <Metric label="缺少路由表" value={String(cdc.missingTables.length)} />
          <Metric
            label="Slot lag bytes"
            value={String(cdc.lagBytes ?? "未知")}
          />
        </div>
      </div>
    </section>
  );
}

export function QueueStatusPanel({ queue }: { queue: QueueStatus }) {
  return (
    <section>
      <SectionTitle
        title="Job-runner 佇列"
        description="佇列計數與失敗工作摘要。"
      />
      <div className="rounded-md bg-surface-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks
              aria-hidden="true"
              className="h-5 w-5 text-text-brand"
            />
            <div>
              <p className="text-sm font-medium leading-[1.4] text-text-primary">
                {queue.item.label}
              </p>
              <p className="text-xs leading-[1.4] text-text-secondary">
                {queue.failedJobs.length > 0
                  ? `${queue.failedJobs.length} 個失敗工作`
                  : "目前沒有失敗工作"}
              </p>
            </div>
          </div>
          <StatusIndicator status={queue.item.status} />
        </div>
        {queue.counts.length === 0 ? (
          <div className="mt-4">
            <EmptyState>目前沒有佇列計數資料。</EmptyState>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm leading-[1.4]">
              <thead className="text-xs text-text-secondary">
                <tr className="border-b border-border-whisper">
                  <th className="py-2 font-medium">Lane</th>
                  <th className="py-2 font-medium">created</th>
                  <th className="py-2 font-medium">active</th>
                  <th className="py-2 font-medium">retry</th>
                  <th className="py-2 font-medium">failed</th>
                  <th className="py-2 font-medium">all</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-whisper">
                {queue.counts.map((count) => (
                  <tr key={count.lane}>
                    <td className="py-2 text-text-primary">{count.lane}</td>
                    <td className="py-2 text-text-secondary">
                      {count.created}
                    </td>
                    <td className="py-2 text-text-secondary">{count.active}</td>
                    <td className="py-2 text-text-secondary">{count.retry}</td>
                    <td className="py-2 text-text-secondary">{count.failed}</td>
                    <td className="py-2 text-text-secondary">{count.all}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function DatabaseStatusPanel({
  databases,
}: {
  databases: StatusItem[];
}) {
  return (
    <section>
      <SectionTitle title="資料庫" description="只呈現安全的狀態與名稱。" />
      <div className="grid gap-3 md:grid-cols-2">
        {databases.map((item) => (
          <div key={item.id} className="rounded-md bg-surface-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database
                  aria-hidden="true"
                  className="h-4 w-4 text-text-brand"
                />
                <span className="text-sm font-medium leading-[1.4] text-text-primary">
                  {item.label}
                </span>
              </div>
              <StatusIndicator status={item.status} />
            </div>
            {item.reason ? (
              <p className="mt-2 text-xs leading-[1.4] text-text-secondary">
                {item.reason}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
