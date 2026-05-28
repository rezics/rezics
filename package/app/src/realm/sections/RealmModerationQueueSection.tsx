import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { governanceRealmQueueListQuery } from "@rezics/api/governance/governance";
import type { RealmModerationQueueItemDTO } from "@rezics/contract";
import { EmptyState, Spinner } from "@rezics/ui";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

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
            <span>Subject {item.subjectUserId}</span>
          ) : null}
          {item.assignedToUserId ? (
            <span>Assigned {item.assignedToUserId}</span>
          ) : null}
          {updatedAt ? <span>Updated {updatedAt}</span> : null}
        </div>
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

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-text-tertiary" aria-hidden />
        <h2 className="text-base font-semibold leading-ui text-text-primary">
          Moderation queue
        </h2>
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
          ) : queueQuery.data?.length ? (
            <div className="grid gap-3">
              {queueQuery.data.map((item) => (
                <QueueItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState title="No realm queue items" />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
