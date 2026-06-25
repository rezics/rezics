import {
  type AdminRepairJobDryRun,
  type AdminRepairJobScope,
  type HistoryOutboxRepairStatus,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Separator,
  Textarea,
} from "@rezics/ui/shadcn";
import { Loader2, Play, Search } from "lucide-react";
import React from "react";
import { Page } from "@/admin/core/layouts/Page";
import { Route } from "@/admin/routes/_admin/repair";
import { Link } from "@/admin/shared/ui/link";
import {
  useAdminRepairJobDryRunMutation,
  useAdminRepairJobStartMutation,
} from "../hooks/useRepairJobMutations";

type RepairScopeConfig = {
  scope: AdminRepairJobScope;
  title: string;
  description: string;
  link?: {
    to: string;
    label: string;
  };
};

const HISTORY_OUTBOX_REPAIR_STATUSES: HistoryOutboxRepairStatus[] = [
  "pending",
  "failed",
];

function buildRepairScopes(t: (key: string) => string): RepairScopeConfig[] {
  return [
    {
      scope: "search",
      title: t("admin:repair_scope_search_title"),
      description: t("admin:repair_scope_search_description"),
      link: { to: "/meili/observability", label: t("admin:repair_link_meili") },
    },
    {
      scope: "queue-failed-job",
      title: t("admin:repair_scope_queue_title"),
      description: t("admin:repair_scope_queue_description"),
      link: { to: "/status", label: t("admin:repair_link_queue") },
    },
    {
      scope: "history-outbox-replay",
      title: t("admin:repair_scope_history_title"),
      description: t("admin:repair_scope_history_description"),
      link: { to: "/status", label: t("admin:repair_link_system") },
    },
    {
      scope: "cdc",
      title: t("admin:repair_scope_cdc_title"),
      description: t("admin:repair_scope_cdc_description"),
      link: { to: "/status/cdc", label: t("admin:repair_link_cdc") },
    },
    {
      scope: "slug",
      title: t("admin:repair_scope_slug_title"),
      description: t("admin:repair_scope_slug_description"),
      link: { to: "/unit", label: t("admin:repair_link_units") },
    },
    {
      scope: "attribution",
      title: t("admin:repair_scope_attribution_title"),
      description: t("admin:repair_scope_attribution_description"),
      link: { to: "/entity", label: t("admin:repair_link_entities") },
    },
    {
      scope: "counters",
      title: t("admin:repair_scope_counters_title"),
      description: t("admin:repair_scope_counters_description"),
      link: { to: "/status", label: t("admin:repair_link_system") },
    },
  ];
}

function parseTargetIds(value: string) {
  const ids = value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return ids.length ? ids : undefined;
}

function DryRunResult({
  dryRun,
  onStart,
  isStarting,
  t,
}: {
  dryRun: AdminRepairJobDryRun | null;
  onStart: () => void;
  isStarting: boolean;
  t: (key: string, values?: Record<string, unknown>) => string;
}) {
  if (!dryRun) {
    return (
      <p className="text-sm leading-[1.4] text-text-secondary">
        {t("admin:repair_dry_run_empty")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-xs text-text-secondary">
            {t("admin:repair_result_scope")}
          </p>
          <p className="mt-1 text-sm font-medium">{dryRun.scope}</p>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-xs text-text-secondary">
            {t("admin:repair_result_affected")}
          </p>
          <p className="mt-1 text-sm font-medium">{dryRun.affectedCount}</p>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-xs text-text-secondary">
            {t("admin:repair_result_dry_run_id")}
          </p>
          <p className="mt-1 break-all text-xs font-mono">{dryRun.id}</p>
        </div>
      </div>

      {dryRun.warnings.length ? (
        <div className="rounded-sm border border-warning-border bg-warning-surface p-3">
          <p className="text-sm font-medium text-warning-text">
            {t("admin:repair_result_warnings")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning-text">
            {dryRun.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {dryRun.sampleTargets.length ? (
        <div>
          <p className="mb-2 text-sm font-medium">
            {t("admin:repair_result_sample_targets")}
          </p>
          <div className="flex flex-wrap gap-1">
            {dryRun.sampleTargets.map((target) => (
              <Badge key={target} variant="outline">
                {target}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          {t("admin:repair_result_no_targets")}
        </p>
      )}

      {dryRun.sampleLimited ? (
        <p className="text-xs leading-[1.4] text-text-secondary">
          {t("admin:repair_result_sample_limited", {
            shown: dryRun.sampleTargets.length,
            total: dryRun.targetIds.length,
          })}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={dryRun.affectedCount === 0 || isStarting}
        onClick={onStart}
      >
        {isStarting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}
        {t("admin:repair_queue")}
      </Button>
    </div>
  );
}

function RepairScopePicker({
  scope,
  onChange,
  repairScopes,
}: {
  scope: AdminRepairJobScope;
  onChange: (scope: AdminRepairJobScope) => void;
  repairScopes: RepairScopeConfig[];
}) {
  return (
    <div className="grid gap-2">
      {repairScopes.map((item) => {
        const selected = item.scope === scope;
        return (
          <button
            key={item.scope}
            type="button"
            aria-pressed={selected}
            className={`rounded-sm border p-3 text-left transition-colors ${
              selected
                ? "border-border-focus bg-surface-base"
                : "border-border-whisper bg-surface-subtle hover:bg-surface-base"
            }`}
            onClick={() => onChange(item.scope)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.scope}</Badge>
              <span className="text-sm font-medium leading-[1.4]">
                {item.title}
              </span>
            </div>
            <p className="mt-2 text-xs leading-[1.4] text-text-secondary">
              {item.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

/**
 * RepairJobsPage
 *
 * 管理後台的資料修復操作台。此頁保持高密度、可掃描的雙欄工作面：
 *
 * Mobile:
 * +--------------------------+
 * | Page title               |
 * | Scope picker             |
 * | Filters / reason         |
 * | Dry-run result           |
 * | Coverage list            |
 * +--------------------------+
 *
 * Tablet:
 * +--------------------------+
 * | Page title               |
 * | Scope picker             |
 * | Filters / reason         |
 * | Dry-run result           |
 * | Coverage grid            |
 * +--------------------------+
 *
 * Desktop:
 * +-------------+------------+
 * | Scope +     | Dry-run    |
 * | filters     | result     |
 * +-------------+------------+
 * | Coverage grid            |
 * +--------------------------+
 *
 * Ultra-wide:
 * +---------------+----------------------+
 * | 360px controls| Fluid result panel   |
 * +---------------+----------------------+
 * | Centered coverage grid               |
 * +--------------------------------------+
 */
export default function RepairJobsPage() {
  const { t } = useTranslation(["admin"]);
  const search = Route.useSearch();
  const repairScopes = React.useMemo(() => buildRepairScopes(t), [t]);
  const [scope, setScope] = React.useState<AdminRepairJobScope>(
    search.scope ?? "search",
  );
  const [targetIds, setTargetIds] = React.useState(search.targetIds ?? "");
  const [historyOutboxStatuses, setHistoryOutboxStatuses] = React.useState<
    HistoryOutboxRepairStatus[]
  >(search.historyOutboxStatuses ?? ["pending", "failed"]);
  const [historyOutboxUnitId, setHistoryOutboxUnitId] = React.useState(
    search.unitId ?? "",
  );
  const [historyOutboxOlderThanMinutes, setHistoryOutboxOlderThanMinutes] =
    React.useState(String(search.olderThanMinutes ?? 5));
  const [historyOutboxLimit, setHistoryOutboxLimit] = React.useState(
    String(search.limit ?? 50),
  );
  const [reason, setReason] = React.useState(search.reason ?? "");
  const [dryRun, setDryRun] = React.useState<AdminRepairJobDryRun | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const selectedScope = repairScopes.find((item) => item.scope === scope);

  const dryRunMutation = useAdminRepairJobDryRunMutation({
    onSuccess: (data) => {
      setDryRun(data);
      setMessage(null);
    },
  });
  const startMutation = useAdminRepairJobStartMutation({
    onSuccess: (job) => {
      setMessage(
        t("admin:repair_started_message", {
          id: job.id,
          status: job.status,
          summary: job.safeSummary,
        }),
      );
    },
  });

  function runDryRun() {
    const parsedOlderThan = Number(historyOutboxOlderThanMinutes);
    const parsedLimit = Number(historyOutboxLimit);
    const input = {
      scope,
      targetIds: parseTargetIds(targetIds),
      ...(scope === "history-outbox-replay"
        ? {
            historyOutboxStatuses,
            unitId: historyOutboxUnitId.trim() || undefined,
            olderThanMinutes: Number.isFinite(parsedOlderThan)
              ? parsedOlderThan
              : undefined,
            limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
          }
        : {}),
      reason: reason.trim() || null,
    };
    setDryRun(null);
    setMessage(null);
    dryRunMutation.mutate(input);
  }

  function toggleHistoryOutboxStatus(status: HistoryOutboxRepairStatus) {
    setHistoryOutboxStatuses((current) => {
      if (current.includes(status)) {
        const next = current.filter((item) => item !== status);
        return next.length ? next : current;
      }
      return [...current, status];
    });
  }

  function startRepair() {
    if (!dryRun) return;
    startMutation.mutate({
      scope: dryRun.scope,
      targetIds: dryRun.targetIds,
      dryRunId: dryRun.id,
      reason: reason.trim() || t("admin:repair_default_reason"),
    });
  }

  return (
    <Page
      title={t("admin:repair_title")}
      description={t("admin:repair_description")}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card surface="contained">
          <CardHeader>
            <CardTitle>{t("admin:repair_scope_card_title")}</CardTitle>
            <CardDescription>
              {t("admin:repair_scope_card_description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin:repair_scope_label")}</Label>
              <RepairScopePicker
                scope={scope}
                repairScopes={repairScopes}
                onChange={(value) => {
                  setScope(value);
                  setDryRun(null);
                  setMessage(null);
                }}
              />
            </div>

            {selectedScope ? (
              <div className="rounded-sm bg-surface-subtle p-3">
                <p className="text-sm font-medium">{selectedScope.title}</p>
                <p className="mt-1 text-sm leading-[1.4] text-text-secondary">
                  {selectedScope.description}
                </p>
                {selectedScope.link ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    render={(props) => (
                      <Link to={selectedScope.link!.to} {...props}>
                        {selectedScope.link!.label}
                      </Link>
                    )}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <Label htmlFor="repair-targets">
                {t("admin:repair_target_ids")}
              </Label>
              <Textarea
                id="repair-targets"
                value={targetIds}
                onChange={(event) => setTargetIds(event.target.value)}
                placeholder={t("admin:repair_target_ids_placeholder")}
                rows={4}
              />
            </div>

            {scope === "history-outbox-replay" ? (
              <div className="space-y-3 rounded-sm bg-surface-subtle p-3">
                <div>
                  <p className="text-sm font-medium leading-[1.4]">
                    {t("admin:repair_history_filters_title")}
                  </p>
                  <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
                    {t("admin:repair_history_filters_description")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {HISTORY_OUTBOX_REPAIR_STATUSES.map((status) => {
                    const statusId = `history-outbox-status-${status}`;
                    return (
                      <div
                        key={status}
                        className="flex items-center gap-2 text-sm leading-[1.4]"
                      >
                        <Checkbox
                          id={statusId}
                          checked={historyOutboxStatuses.includes(status)}
                          onCheckedChange={() =>
                            toggleHistoryOutboxStatus(status)
                          }
                        />
                        <Label htmlFor={statusId}>{status}</Label>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="history-outbox-unit-id">
                      {t("admin:repair_history_unit_id")}
                    </Label>
                    <Input
                      id="history-outbox-unit-id"
                      value={historyOutboxUnitId}
                      onChange={(event) =>
                        setHistoryOutboxUnitId(event.target.value)
                      }
                      placeholder={t(
                        "admin:repair_history_unit_id_placeholder",
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="history-outbox-age">
                      {t("admin:repair_history_older_than")}
                    </Label>
                    <Input
                      id="history-outbox-age"
                      type="number"
                      min={0}
                      value={historyOutboxOlderThanMinutes}
                      onChange={(event) =>
                        setHistoryOutboxOlderThanMinutes(event.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="history-outbox-limit">
                      {t("admin:repair_history_limit")}
                    </Label>
                    <Input
                      id="history-outbox-limit"
                      type="number"
                      min={1}
                      max={500}
                      value={historyOutboxLimit}
                      onChange={(event) =>
                        setHistoryOutboxLimit(event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <Label htmlFor="repair-reason">{t("admin:repair_reason")}</Label>
              <Input
                id="repair-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("admin:repair_reason_placeholder")}
              />
            </div>

            <Button
              type="button"
              onClick={runDryRun}
              disabled={dryRunMutation.isPending}
            >
              {dryRunMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {t("admin:repair_run_dry_run")}
            </Button>

            {dryRunMutation.isError || startMutation.isError ? (
              <p className="text-sm leading-[1.4] text-error-text">
                {
                  (
                    dryRunMutation.error ??
                    startMutation.error ??
                    new Error(t("admin:repair_request_failed"))
                  ).message
                }
              </p>
            ) : null}
            {message ? (
              <p className="text-sm leading-[1.4] text-success-text">
                {message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card surface="contained">
          <CardHeader>
            <CardTitle>{t("admin:repair_result_title")}</CardTitle>
            <CardDescription>
              {t("admin:repair_result_description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DryRunResult
              dryRun={dryRun}
              onStart={startRepair}
              isStarting={startMutation.isPending}
              t={t}
            />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-4" />

      <Card surface="contained">
        <CardHeader>
          <CardTitle>{t("admin:repair_coverage_title")}</CardTitle>
          <CardDescription>
            {t("admin:repair_coverage_description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {repairScopes.map((item) => (
              <div
                key={item.scope}
                className="rounded-sm border border-border-whisper p-3"
              >
                <Badge variant="outline">{item.scope}</Badge>
                <p className="mt-2 text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
