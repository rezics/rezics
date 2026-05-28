import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import {
  governanceAuditListQuery,
  governanceRealmQueueListQuery,
} from "@rezics/api/governance/governance";
import type { RealmModerationQueueItemDTO } from "@rezics/contract";
import { EmptyState, Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ClipboardList,
  FileClock,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

interface RealmModerationQueueSectionProps {
  realmUnitId: string;
}

function queueStateVariant(state: string) {
  if (state === "new" || state === "triaged") return "secondary";
  if (state === "resolved" || state === "actioned") return "default";
  return "outline";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function QueueItemCard({ item }: { item: RealmModerationQueueItemDTO }) {
  const summary = item.reason ?? item.safeSummary ?? "No summary recorded.";
  const updatedAt = formatDate(item.updatedAt);

  return (
    <Card surface="plain">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={queueStateVariant(item.state)}>{item.state}</Badge>
          <span className="text-sm font-medium leading-ui text-text-primary">
            {item.target.kind}:{item.target.id}
          </span>
          {item.linkedCaseId ? (
            <Badge variant="outline">case linked</Badge>
          ) : null}
        </div>
        <p className="m-0 text-sm leading-body text-text-secondary">
          {summary}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-ui text-text-tertiary">
          {item.subjectUserId ? (
            <Link
              to="/staff/account/$targetUserId"
              params={{ targetUserId: item.subjectUserId }}
              className="underline-offset-2 hover:text-text-primary hover:underline"
            >
              Subject {item.subjectUserId}
            </Link>
          ) : null}
          {item.assignedToUserId ? (
            <span>Assigned {item.assignedToUserId}</span>
          ) : null}
          {updatedAt ? <span>Updated {updatedAt}</span> : null}
        </div>
        {item.linkedCaseId ? (
          <div>
            <Link
              to="/staff/case/$caseId"
              params={{ caseId: item.linkedCaseId }}
            >
              <Button variant="outline" size="sm">
                Open case
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <Card surface="contained">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase leading-ui text-text-tertiary">
              {title}
            </div>
            <div className="mt-2 text-2xl font-semibold leading-ui text-text-primary">
              {value}
            </div>
          </div>
          <Icon className="h-5 w-5 text-text-tertiary" aria-hidden />
        </div>
        <p className="m-0 flex-1 text-sm leading-body text-text-secondary">
          {detail}
        </p>
        {children ? (
          <div className="flex flex-wrap gap-2">{children}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RealmModerationQueueSection({
  realmUnitId,
}: RealmModerationQueueSectionProps) {
  const queueQuery = useQuery(
    governanceRealmQueueListQuery(realmUnitId, { limit: 25 }),
  );
  const auditQuery = useQuery(
    governanceAuditListQuery({
      targetKind: "realm",
      targetId: realmUnitId,
      limit: 6,
    }),
  );

  const queueItems = queueQuery.data ?? [];
  const openQueueItems = queueItems.filter(
    (item) => item.state !== "resolved" && item.state !== "rejected",
  );
  const linkedCases = new Set(
    queueItems
      .map((item) => item.linkedCaseId)
      .filter((caseId): caseId is string => Boolean(caseId)),
  );
  const subjectUserIds = queueItems
    .map((item) => item.subjectUserId)
    .filter((userId): userId is string => Boolean(userId));
  const firstSubjectUserId = subjectUserIds[0];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-text-tertiary" aria-hidden />
        <h2 className="text-base font-semibold leading-ui text-text-primary">
          Moderation
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ClipboardList}
          title="Reports"
          value={String(openQueueItems.length)}
          detail="Realm queue intake for reports, owner delegation, and moderation decisions."
        >
          <Link to="/staff" search={{ realmUnitId, accountUserId: undefined }}>
            <Button variant="outline" size="sm">
              Staff queue
            </Button>
          </Link>
        </MetricCard>
        <MetricCard
          icon={Scale}
          title="Cases"
          value={String(linkedCases.size)}
          detail="Escalated queue items that have a linked foundation moderation case."
        >
          {Array.from(linkedCases)
            .slice(0, 1)
            .map((caseId) => (
              <Link key={caseId} to="/staff/case/$caseId" params={{ caseId }}>
                <Button variant="outline" size="sm">
                  Open case
                </Button>
              </Link>
            ))}
        </MetricCard>
        <MetricCard
          icon={UserRoundCheck}
          title="Sanctions"
          value={String(new Set(subjectUserIds).size)}
          detail="Subject accounts connected to this realm's queue and enforcement history."
        >
          {firstSubjectUserId ? (
            <Link
              to="/staff/account/$targetUserId"
              params={{ targetUserId: firstSubjectUserId }}
            >
              <Button variant="outline" size="sm">
                Account safety
              </Button>
            </Link>
          ) : null}
        </MetricCard>
        <MetricCard
          icon={FileClock}
          title="Audit"
          value={
            auditQuery.isLoading ? "..." : String(auditQuery.data?.length ?? 0)
          }
          detail="Recent privileged actions scoped to this realm when audit access is available."
        >
          <Link
            to="/staff/audit"
            search={{ targetKind: "realm", targetId: realmUnitId }}
          >
            <Button variant="outline" size="sm">
              Audit view
            </Button>
          </Link>
        </MetricCard>
      </div>
      <Card surface="contained">
        <CardHeader>
          <CardTitle>Realm reports</CardTitle>
        </CardHeader>
        <CardContent>
          {queueQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : queueQuery.isError ? (
            <QueryErrorDisplay error={queueQuery.error} />
          ) : queueItems.length ? (
            <div className="grid gap-3">
              {queueItems.map((item) => (
                <QueueItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState title="No realm queue items" />
          )}
        </CardContent>
      </Card>
      {auditQuery.isError ? (
        <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
          Unable to load realm audit records.
        </div>
      ) : auditQuery.data?.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4 text-text-tertiary" aria-hidden />
            <h3 className="text-base font-semibold leading-ui text-text-primary">
              Recent audit
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {auditQuery.data.map((entry) => (
              <Card key={entry.id} surface="plain">
                <CardContent className="p-4">
                  <div className="text-sm font-medium leading-ui text-text-primary">
                    {entry.action}
                  </div>
                  <p className="mt-1 text-xs leading-ui text-text-tertiary">
                    {formatDate(entry.createdAt)}
                  </p>
                  <p className="mt-2 text-sm leading-body text-text-secondary">
                    {entry.reason}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
