import type {
  MeiliIndexStatus,
  StatusItem,
  StatusState,
  SystemStatusSummary,
} from "@rezics/contract";

export type { StatusState };

export const STATUS_ORDER: StatusState[] = [
  "unavailable",
  "degraded",
  "unknown",
  "available",
];

export function formatStatusState(status: StatusState): string {
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

export function describeStatusState(status: StatusState): string {
  switch (status) {
    case "available":
      return "所有已設定檢查目前可用";
    case "degraded":
      return "部分檢查可用但需要處理";
    case "unavailable":
      return "至少一個必要服務不可用";
    case "unknown":
      return "部分檢查尚未設定或無法判定";
  }
}

export function statusTextClass(status: StatusState): string {
  switch (status) {
    case "available":
      return "text-success-text";
    case "degraded":
      return "text-warning-text";
    case "unavailable":
      return "text-error-text";
    case "unknown":
      return "text-text-secondary";
  }
}

export function statusBorderClass(status: StatusState): string {
  switch (status) {
    case "available":
      return "border-success-fill";
    case "degraded":
      return "border-warning-fill";
    case "unavailable":
      return "border-error-fill";
    case "unknown":
      return "border-border-defined";
  }
}

export function statusFillClass(status: StatusState): string {
  switch (status) {
    case "available":
      return "bg-success-fill";
    case "degraded":
      return "bg-warning-fill";
    case "unavailable":
      return "bg-error-fill";
    case "unknown":
      return "bg-surface-sunken";
  }
}

export function getStatusItems(summary: SystemStatusSummary): StatusItem[] {
  return [
    ...summary.services,
    ...summary.databases,
    summary.cdc.item,
    summary.queue.item,
    summary.sequin,
    {
      id: "meili",
      label: "Meilisearch",
      status: summary.meili.status,
      checkedAt: summary.meili.checkedAt,
      reason: summary.meili.reason,
    },
  ];
}

export function countStatusStates(
  items: StatusItem[],
): Record<StatusState, number> {
  return {
    available: items.filter((item) => item.status === "available").length,
    degraded: items.filter((item) => item.status === "degraded").length,
    unavailable: items.filter((item) => item.status === "unavailable").length,
    unknown: items.filter((item) => item.status === "unknown").length,
  };
}

// STATUS_ORDER is worst-first, so the lowest index wins when rolling several
// checks up into one badge for a status sub-section.
// STATUS_ORDER 以最差优先排列，因此在将多个检查汇总为某个状态子区块的单个徽章时，
// 索引最小者胜出。
export function worstStatusState(states: StatusState[]): StatusState {
  if (states.length === 0) return "unknown";
  return states.reduce((worst, state) =>
    STATUS_ORDER.indexOf(state) < STATUS_ORDER.indexOf(worst) ? state : worst,
  );
}

export function getMeiliDriftCount(indexes: MeiliIndexStatus[]): number {
  return indexes.filter((index) => index.settingsDrift?.hasDrift).length;
}

export function formatCheckedAt(value?: string | null): string {
  if (!value) return "未回報";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-Hant", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}
