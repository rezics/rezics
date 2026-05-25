import { useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight } from "lucide-react";
import { useCanViewStatus, useSystemStatusData } from "../hooks/useStatusData";
import {
  describeStatusState,
  STATUS_ROUTE,
  summarizeSystemStatus,
} from "../models/status";
import { StatusIndicator } from "./StatusIndicator";

export function StatusOverviewCard() {
  const canViewStatus = useCanViewStatus();
  const navigate = useNavigate();
  const query = useSystemStatusData();

  if (!canViewStatus) return null;

  const summary = summarizeSystemStatus(query.data);
  const description = query.isLoading
    ? "正在讀取內部服務狀態"
    : query.isError
      ? "狀態 API 暫時無法讀取"
      : describeStatusState(summary.status);

  return (
    <button
      type="button"
      className="group flex w-full items-center justify-between gap-4 rounded-md bg-surface-elevated p-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      onClick={() => navigate({ to: STATUS_ROUTE })}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-text-brand">
          <Activity aria-hidden="true" className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium leading-[1.4] text-text-primary">
            系統狀態
          </span>
          <span className="mt-1 block text-xs leading-[1.4] text-text-secondary">
            {description}
            {summary.affectedCount > 0
              ? `，${summary.affectedCount} 個項目需處理`
              : ""}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusIndicator status={summary.status} />
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 text-text-secondary transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}
