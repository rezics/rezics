import { Card, CardContent } from "@rezics/ui/shadcn";
import { ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "@/admin/shared/ui/link";
import { useAdminSystemStatusQuery } from "../hooks/useAdminStatusQueries";
import {
  countStatusStates,
  describeStatusState,
  formatCheckedAt,
  getStatusItems,
} from "../models/status";
import { StatusIndicator } from "./StatusIndicator";

export function StatusOverviewCard() {
  const query = useAdminSystemStatusQuery();
  const summary = query.data;
  const counts = summary ? countStatusStates(getStatusItems(summary)) : null;
  const affectedCount = counts ? counts.degraded + counts.unavailable : 0;

  return (
    <Card className="border-border-whisper bg-surface-base">
      <CardContent className="p-4">
        <Link
          to="/status"
          className="group flex flex-col gap-3 no-underline text-text-primary sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold leading-[1.4]">系統狀態</p>
              {summary ? (
                <StatusIndicator status={summary.status} />
              ) : query.isLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                  <RefreshCw className="size-3.5 animate-spin" />
                  載入中
                </span>
              ) : (
                <StatusIndicator status="unknown" />
              )}
            </div>
            <p className="text-xs leading-[1.4] text-text-secondary">
              {summary
                ? describeStatusState(summary.status)
                : query.isError
                  ? "無法讀取內部狀態摘要"
                  : "正在讀取服務、佇列、CDC 與 Meili 狀態"}
            </p>
            {summary ? (
              <p className="text-xs leading-[1.4] text-text-tertiary">
                受影響項目 {affectedCount} 個 · 最後檢查{" "}
                {formatCheckedAt(summary.checkedAt)}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-text-secondary group-hover:text-text-primary">
            查看詳情
            <ArrowRight className="size-4" aria-hidden="true" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
