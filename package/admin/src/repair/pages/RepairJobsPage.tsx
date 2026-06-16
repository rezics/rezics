import {
  type AdminRepairJobDryRun,
  type AdminRepairJobScope,
  type HistoryOutboxRepairStatus,
  useAdminRepairJobDryRunMutation,
  useAdminRepairJobStartMutation,
} from "@rezics/api";
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
import { Page } from "@/core/layouts/Page";
import { Route } from "@/routes/_admin/repair";
import { Link } from "@/shared/ui/link";

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

const repairScopes: RepairScopeConfig[] = [
  {
    scope: "search",
    title: "Search projections",
    description:
      "Detects Meili indexes with missing indexes or schema/settings drift.",
    link: { to: "/meili/observability", label: "Open Meili status" },
  },
  {
    scope: "queue-failed-job",
    title: "Failed queue jobs",
    description:
      "Detects failed pg-boss jobs that can be retried through job-runner admin endpoints.",
    link: { to: "/status", label: "Open queue status" },
  },
  {
    scope: "history-outbox-replay",
    title: "History outbox replay",
    description:
      "Finds pending or failed HistoryOutbox rows and queues idempotent history ingest jobs.",
    link: { to: "/status", label: "Open system status" },
  },
  {
    scope: "slug",
    title: "Slugs and aliases",
    description:
      "Dry-run contract for slug and alias drift repair. Detector wiring is pending.",
    link: { to: "/unit", label: "Open Units" },
  },
  {
    scope: "attribution",
    title: "Attribution",
    description:
      "Dry-run contract for credit and subject attribution repair. Detector wiring is pending.",
    link: { to: "/entity", label: "Open Entities" },
  },
  {
    scope: "counters",
    title: "Denormalized counters",
    description:
      "Dry-run contract for denormalized count repair. Detector wiring is pending.",
    link: { to: "/status", label: "Open system status" },
  },
];

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
}: {
  dryRun: AdminRepairJobDryRun | null;
  onStart: () => void;
  isStarting: boolean;
}) {
  if (!dryRun) {
    return (
      <p className="text-sm leading-[1.4] text-text-secondary">
        Run a dry-run first to see affected counts and sample targets without
        mutating data.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-xs text-text-secondary">Scope</p>
          <p className="mt-1 text-sm font-medium">{dryRun.scope}</p>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-xs text-text-secondary">Affected</p>
          <p className="mt-1 text-sm font-medium">{dryRun.affectedCount}</p>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-xs text-text-secondary">Dry-run id</p>
          <p className="mt-1 break-all text-xs font-mono">{dryRun.id}</p>
        </div>
      </div>

      {dryRun.warnings.length ? (
        <div className="rounded-sm border border-warning-border bg-warning-surface p-3">
          <p className="text-sm font-medium text-warning-text">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning-text">
            {dryRun.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {dryRun.sampleTargets.length ? (
        <div>
          <p className="mb-2 text-sm font-medium">Sample targets</p>
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
          No affected targets were reported for this dry-run.
        </p>
      )}

      {dryRun.sampleLimited ? (
        <p className="text-xs leading-[1.4] text-text-secondary">
          Showing the first {dryRun.sampleTargets.length} targets. Queueing uses
          all {dryRun.targetIds.length} dry-run targets.
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
        Queue repair
      </Button>
    </div>
  );
}

function RepairScopePicker({
  scope,
  onChange,
}: {
  scope: AdminRepairJobScope;
  onChange: (scope: AdminRepairJobScope) => void;
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

export default function RepairJobsPage() {
  const search = Route.useSearch();
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
      setMessage(`${job.id} ${job.status}. ${job.safeSummary}`);
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
      reason: reason.trim() || "Repair drift from admin dry-run",
    });
  }

  return (
    <Page
      title="Repair jobs"
      description="Dry-run and queue data integrity repairs through typed admin APIs."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card surface="contained">
          <CardHeader>
            <CardTitle>Repair scope</CardTitle>
            <CardDescription>
              Choose a repair detector and optionally narrow the target ids.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Scope</Label>
              <RepairScopePicker
                scope={scope}
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
              <Label htmlFor="repair-targets">Target ids</Label>
              <Textarea
                id="repair-targets"
                value={targetIds}
                onChange={(event) => setTargetIds(event.target.value)}
                placeholder="optional ids, comma or newline separated"
                rows={4}
              />
            </div>

            {scope === "history-outbox-replay" ? (
              <div className="space-y-3 rounded-sm bg-surface-subtle p-3">
                <div>
                  <p className="text-sm font-medium leading-[1.4]">
                    HistoryOutbox filters
                  </p>
                  <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
                    Explicit target ids are treated as HistoryOutbox row ids.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {HISTORY_OUTBOX_REPAIR_STATUSES.map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-2 text-sm leading-[1.4]"
                    >
                      <Checkbox
                        checked={historyOutboxStatuses.includes(status)}
                        onCheckedChange={() =>
                          toggleHistoryOutboxStatus(status)
                        }
                      />
                      {status}
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="history-outbox-unit-id">Unit id</Label>
                    <Input
                      id="history-outbox-unit-id"
                      value={historyOutboxUnitId}
                      onChange={(event) =>
                        setHistoryOutboxUnitId(event.target.value)
                      }
                      placeholder="optional unit id"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="history-outbox-age">Older than min</Label>
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
                    <Label htmlFor="history-outbox-limit">Max enqueue</Label>
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
              <Label htmlFor="repair-reason">Reason</Label>
              <Input
                id="repair-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="operator reason"
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
              Run dry-run
            </Button>

            {dryRunMutation.isError || startMutation.isError ? (
              <p className="text-sm leading-[1.4] text-error-text">
                {
                  (
                    dryRunMutation.error ??
                    startMutation.error ??
                    new Error("Repair request failed")
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
            <CardTitle>Dry-run result</CardTitle>
            <CardDescription>
              Results show affected counts and samples only. Queueing repair is
              separate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DryRunResult
              dryRun={dryRun}
              onStart={startRepair}
              isStarting={startMutation.isPending}
            />
          </CardContent>
        </Card>
      </div>

      <Separator className="my-4" />

      <Card surface="contained">
        <CardHeader>
          <CardTitle>Repair coverage</CardTitle>
          <CardDescription>
            The surface covers every data-integrity scope from the OpenSpec
            task. Some scopes have contracts before detector implementation.
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
