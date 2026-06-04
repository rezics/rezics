import {
  type GovernanceAuditListQuery,
  governanceQueries,
} from "@rezics/api/governance/governance";
import type { AdminDashboardSummary } from "@rezics/api/stat/stats";
import { adminDashboardSummaryQueryOptions } from "@rezics/api/stat/stats.queries";
import type {
  DecisionCode,
  ModerationCaseDTO,
  StaffAuditLogDTO,
} from "@rezics/contract";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rezics/ui/shadcn";
import { useQueries, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  FileClock,
  Gavel,
  History,
  ShieldAlert,
  UserX,
} from "lucide-react";
import React from "react";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";

const openCaseStates = new Set<ModerationCaseDTO["state"]>([
  "new",
  "triaged",
  "assigned",
  "escalated",
]);

const policyExceptionCodes: DecisionCode[] = [
  "MISSING_CAPABILITY",
  "ENFORCEMENT_ACTIVE",
  "BLOCKED_ACCOUNT",
  "CROSS_REALM_DENIED",
  "LAST_OWNER_PROTECTED",
  "RATE_LIMITED",
  "NOT_MEMBER",
  "MISSING_RESOURCE",
  "OWNERSHIP_REQUIRED",
  "INSUFFICIENT_ROLE",
  "EXPIRED_GRANT",
  "INVALID_STATE",
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-Hant");
}

function MetricCard({
  title,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  tone?: "neutral" | "warning" | "error";
}) {
  const iconClass =
    tone === "error"
      ? "bg-error-fill text-white"
      : tone === "warning"
        ? "bg-warning-fill text-white"
        : "bg-surface-subtle text-text-secondary";

  return (
    <Card className="border-border-whisper bg-surface-base">
      <CardContent className="flex h-full items-start gap-3 p-4">
        <span
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-sm ${iconClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium leading-[1.4] text-text-secondary">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-[1.3]">
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs leading-[1.4] text-text-tertiary">
            {detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CaseStateBadge({ state }: { state: ModerationCaseDTO["state"] }) {
  const escalated = state === "escalated";
  const open = openCaseStates.has(state);
  return (
    <Badge variant={escalated ? "destructive" : open ? "secondary" : "outline"}>
      {state}
    </Badge>
  );
}

function AuditDecisionBadge({ code }: { code: string }) {
  return (
    <Badge variant={code === "ALLOWED" ? "outline" : "destructive"}>
      {code}
    </Badge>
  );
}

function RecentCasesTable({ cases }: { cases: ModerationCaseDTO[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Case</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.length ? (
            cases.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-[220px]">
                  <div className="truncate font-medium">{item.id}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {item.safeSummary ?? item.reason ?? "No summary"}
                  </div>
                </TableCell>
                <TableCell>
                  <CaseStateBadge state={item.state} />
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <div className="truncate">{item.target.kind}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {item.target.id}
                  </div>
                </TableCell>
                <TableCell>{item.assignedToUserId ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-text-secondary">
                  {formatDate(item.updatedAt)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm">
                No moderation cases found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RealmEscalationsTable({ items }: { items: ModerationCaseDTO[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Case</TableHead>
            <TableHead>Realm</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Parent Case</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length ? (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-[220px]">
                  <div className="truncate font-medium">{item.id}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {item.safeSummary ?? item.reason ?? "Escalated to staff"}
                  </div>
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <span className="truncate font-mono text-xs">
                    {item.realmUnitId}
                  </span>
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <div className="truncate">{item.target.kind}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {item.target.id}
                  </div>
                </TableCell>
                <TableCell>{item.parentCaseId ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-text-secondary">
                  {formatDate(item.updatedAt)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm">
                No escalated realm cases.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function AuditTable({
  audits,
  empty,
}: {
  audits: StaffAuditLogDTO[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Decision</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audits.length ? (
            audits.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-[240px]">
                  <div className="truncate font-medium">{item.action}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {item.reason}
                  </div>
                </TableCell>
                <TableCell>
                  <AuditDecisionBadge code={item.decisionCode} />
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <div className="truncate">{item.targetKind}</div>
                  <div className="truncate text-xs text-text-secondary">
                    {item.targetId}
                  </div>
                </TableCell>
                <TableCell>{item.actorUserId}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-text-secondary">
                  {formatDate(item.createdAt)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function summarizeCases(cases: ModerationCaseDTO[]) {
  return cases.reduce(
    (summary, item) => {
      if (openCaseStates.has(item.state)) summary.open += 1;
      if (item.state === "escalated") summary.escalated += 1;
      if (item.assignedToUserId) summary.assigned += 1;
      return summary;
    },
    { open: 0, escalated: 0, assigned: 0 },
  );
}

function uniqueAudits(audits: StaffAuditLogDTO[]) {
  const seen = new Set<string>();
  return audits.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function PolicyExceptionPanel({
  query,
}: {
  query: Array<{
    data?: StaffAuditLogDTO[];
    isLoading: boolean;
    isError: boolean;
  }>;
}) {
  const audits = React.useMemo(
    () =>
      uniqueAudits(
        query
          .flatMap((result) => result.data ?? [])
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
      ).slice(0, 8),
    [query],
  );
  const loading = query.some((result) => result.isLoading);
  const error = query.some((result) => result.isError);

  return (
    <Card surface="contained">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base leading-[1.4]">
            Policy Exceptions
          </CardTitle>
          <Badge variant={audits.length ? "destructive" : "outline"}>
            {loading ? "loading" : `${audits.length} recent`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {error ? (
          <p className="rounded-sm bg-error-fill/10 p-3 text-sm text-error-text">
            Policy exception audit scan failed.
          </p>
        ) : (
          <AuditTable
            audits={audits}
            empty={
              loading
                ? "Loading policy exception audit entries."
                : "No recent non-allowed policy audit entries."
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function GovernanceMetrics({
  summary,
  recentCases,
}: {
  summary: AdminDashboardSummary;
  recentCases: ModerationCaseDTO[];
}) {
  const caseSummary = summarizeCases(recentCases);
  const escalations =
    summary.governance.escalatedCases + summary.governance.realmCasesEscalated;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Open Cases"
        value={summary.governance.openCases}
        detail={`Recent page: ${caseSummary.open} open / ${caseSummary.assigned} assigned`}
        icon={<ClipboardList className="size-4" />}
      />
      <MetricCard
        title="Escalations"
        value={escalations}
        detail={`${summary.governance.escalatedCases} platform / ${summary.governance.realmCasesEscalated} realm`}
        icon={<ShieldAlert className="size-4" />}
        tone={escalations > 0 ? "warning" : "neutral"}
      />
      <MetricCard
        title="Active Enforcement"
        value={summary.governance.activeEnforcements}
        detail="Site-wide account enforcement records currently active"
        icon={<UserX className="size-4" />}
        tone={summary.governance.activeEnforcements > 0 ? "warning" : "neutral"}
      />
      <MetricCard
        title="Realm Cases"
        value={summary.governance.realmCasesOpen}
        detail="Day-to-day realm cases stay in app; admin tracks escalated load"
        icon={<Gavel className="size-4" />}
      />
    </div>
  );
}

export default function GovernanceOverviewPage() {
  const { data: summary } = useSuspenseQuery(
    adminDashboardSummaryQueryOptions(),
  );
  const recentCasesQuery = useSuspenseQuery(
    governanceQueries.caseList({ limit: 10 }),
  );
  const escalatedRealmCasesQuery = useSuspenseQuery(
    governanceQueries.escalatedRealmCases({ limit: 8 }),
  );
  const auditQuery = useQuery(governanceQueries.auditList({ limit: 10 }));
  const policyExceptionQuery = useQueries({
    queries: policyExceptionCodes.map((decisionCode) =>
      governanceQueries.auditList({
        decisionCode,
        limit: 3,
      } satisfies GovernanceAuditListQuery),
    ),
  });

  const recentCases = recentCasesQuery.data;
  const escalatedCases = recentCases.filter(
    (item) => item.state === "escalated",
  );

  return (
    <Page
      title="Governance Overview"
      description="Site-wide moderation, escalation, enforcement, policy, and audit signals for operators."
      actions={
        <div className="flex gap-2">
          <Link
            to="/authority"
            className={buttonVariants({ variant: "outline" })}
          >
            <FileClock className="size-4" />
            Authority
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <GovernanceMetrics summary={summary} recentCases={recentCases} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <Card surface="contained">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base leading-[1.4]">
                  Recent Site Cases
                </CardTitle>
                <Badge
                  variant={escalatedCases.length ? "destructive" : "outline"}
                >
                  {escalatedCases.length} escalated
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <RecentCasesTable cases={recentCases} />
            </CardContent>
          </Card>

          <Card surface="contained">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base leading-[1.4]">
                Audit Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="grid gap-3">
                <div className="rounded-sm bg-surface-subtle p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <History className="size-4" />
                    Recent privileged operations
                  </div>
                  <p className="mt-1 text-xs leading-[1.4] text-text-secondary">
                    {summary.audit.recent.length} entries in dashboard summary ·
                    latest check {formatDate(summary.checkedAt)}
                  </p>
                </div>
                {summary.audit.recent.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-border-whisper pb-3 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {item.action}
                        </p>
                        <p className="truncate text-xs text-text-secondary">
                          {item.targetKind}:{item.targetId}
                        </p>
                      </div>
                      <AuditDecisionBadge code={item.decisionCode} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <PolicyExceptionPanel query={policyExceptionQuery} />

        <Card surface="contained">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base leading-[1.4]">
                Realm Escalations
              </CardTitle>
              <Badge
                variant={
                  escalatedRealmCasesQuery.data.length
                    ? "destructive"
                    : "outline"
                }
              >
                {escalatedRealmCasesQuery.data.length} operator-relevant
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <p className="mb-3 text-sm leading-[1.4] text-text-secondary">
              Ordinary realm case work remains in the app realm console. Admin
              lists only escalated cases that need site staff visibility.
            </p>
            <RealmEscalationsTable items={escalatedRealmCasesQuery.data} />
          </CardContent>
        </Card>

        <Card surface="contained">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base leading-[1.4]">
              Staff Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {auditQuery.isError ? (
              <p className="rounded-sm bg-error-fill/10 p-3 text-sm text-error-text">
                Staff audit list failed to load.
              </p>
            ) : (
              <AuditTable
                audits={auditQuery.data ?? []}
                empty={
                  auditQuery.isLoading
                    ? "Loading staff audit entries."
                    : "No staff audit entries found."
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
