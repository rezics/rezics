import type {
  AdminRepairJobScope,
  HistoryOutboxRepairStatus,
} from "@rezics/api";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RepairJobsPage = lazyRouteComponent(
  () => import("@/admin/repair/pages/RepairJobsPage"),
);

const repairScopes = new Set<AdminRepairJobScope>([
  "search",
  "queue-failed-job",
  "history-outbox-replay",
  "cdc",
  "slug",
  "attribution",
  "counters",
]);
const historyOutboxStatuses = new Set<HistoryOutboxRepairStatus>([
  "pending",
  "failed",
]);

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseStatusList(
  value: unknown,
): HistoryOutboxRepairStatus[] | undefined {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const statuses = raw.filter(
    (item): item is HistoryOutboxRepairStatus =>
      typeof item === "string" &&
      historyOutboxStatuses.has(item as HistoryOutboxRepairStatus),
  );
  return statuses.length ? [...new Set(statuses)] : undefined;
}

export const Route = createFileRoute("/_admin/repair")({
  validateSearch: (search: Record<string, unknown>) => ({
    scope:
      typeof search.scope === "string" &&
      repairScopes.has(search.scope as AdminRepairJobScope)
        ? (search.scope as AdminRepairJobScope)
        : undefined,
    targetIds:
      typeof search.targetIds === "string" ? search.targetIds : undefined,
    historyOutboxStatuses: parseStatusList(search.historyOutboxStatuses),
    unitId: typeof search.unitId === "string" ? search.unitId : undefined,
    olderThanMinutes: parseNumber(search.olderThanMinutes),
    limit: parseNumber(search.limit),
    reason: typeof search.reason === "string" ? search.reason : undefined,
  }),
  component: RepairJobsPage,
});
