import { Button } from "@rezics/ui/shadcn";
import { RefreshCw } from "lucide-react";
import { Page } from "@/core/layouts/Page";
import { useAdminSystemStatusQuery } from "../hooks/useAdminStatusQueries";
import {
  describeStatusState,
  formatCheckedAt,
  formatStatusState,
} from "../models/status";
import { StatusIndicator } from "../components/StatusIndicator";
import { SystemStatusPanels } from "../components/StatusPanels";

export function StatusPage() {
  const query = useAdminSystemStatusQuery();
  const summary = query.data;

  return (
    <Page
      title="系統狀態"
      description={
        summary
          ? `${formatStatusState(summary.status)}：${describeStatusState(summary.status)}。最後檢查 ${formatCheckedAt(summary.checkedAt)}`
          : "內部服務、Meili、Sequin CDC、資料庫與 job-runner 佇列的唯讀診斷。"
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
        <SystemStatusPanels
          summary={summary}
          isLoading={query.isLoading}
          isError={query.isError}
        />
      </div>
    </Page>
  );
}

export default StatusPage;
