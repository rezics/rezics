import type { StatusState, SystemStatusSummary } from "@rezics/api";

export const STATUS_ROUTE = "/status";

export function isAdminStatusRole(role: unknown): boolean {
  if (Array.isArray(role)) {
    return role.includes("ADMIN") || role.includes("ROOT");
  }
  return role === "ADMIN" || role === "ROOT";
}

export function summarizeSystemStatus(
  summary: SystemStatusSummary | undefined,
) {
  if (!summary) {
    return {
      status: "unknown" as StatusState,
      affectedCount: 0,
      totalCount: 0,
    };
  }

  const items = [
    ...summary.services,
    ...summary.databases,
    summary.queue.item,
    summary.sequin,
  ];
  const affectedCount = items.filter(
    (item) => item.status === "degraded" || item.status === "unavailable",
  ).length;

  return {
    status: summary.status,
    affectedCount,
    totalCount: items.length,
  };
}

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
      return "所有檢查目前正常";
    case "degraded":
      return "部分依賴可達但需要處理";
    case "unavailable":
      return "有依賴無法連線或健康檢查失敗";
    case "unknown":
      return "尚未設定或暫時沒有足夠資料";
  }
}
