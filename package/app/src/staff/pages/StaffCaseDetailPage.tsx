import {
  governanceCaseDetailQuery,
  governanceCaseEventsQuery,
  governanceAuditListQuery,
} from "@rezics/api/governance/governance";
import { Badge, Card, CardContent, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import {
  formatStaffDate,
  StaffForbiddenState,
  StaffLoadingState,
  StaffPageShell,
  useStaffConsoleAccess,
} from "./shared";

export function StaffCaseDetailPage({ caseId }: { caseId: string }) {
  const { status, allowed } = useStaffConsoleAccess();
  const caseQuery = useQuery({
    ...governanceCaseDetailQuery(caseId),
    enabled: allowed,
  });
  const eventsQuery = useQuery({
    ...governanceCaseEventsQuery(caseId, { limit: 50 }),
    enabled: allowed,
  });
  const auditQuery = useQuery({
    ...governanceAuditListQuery({
      targetKind: "moderation-case",
      targetId: caseId,
      limit: 25,
    }),
    enabled: allowed,
  });

  if (status === "idle" || status === "loading") return <StaffLoadingState />;
  if (!allowed) return <StaffForbiddenState />;

  const item = caseQuery.data;

  return (
    <StaffPageShell
      title="Case detail"
      description="Inspect case state, event history, and linked staff audit records."
    >
      {caseQuery.isLoading ? (
        <div className="h-48 rounded-md bg-surface-subtle" />
      ) : caseQuery.isError || !item ? (
        <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
          Unable to load this moderation case.
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <Card surface="contained">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{item.state}</Badge>
                  {item.severity ? (
                    <Badge variant="outline">{item.severity}</Badge>
                  ) : null}
                  {item.assignedToUserId ? (
                    <Badge variant="secondary">
                      Assigned {item.assignedToUserId}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Unassigned</Badge>
                  )}
                </div>
                <dl className="mt-5 grid gap-4 text-sm leading-body md:grid-cols-2">
                  <div>
                    <dt className="text-text-tertiary">Target</dt>
                    <dd className="mt-1 text-text-primary">
                      {item.target.kind}:{item.target.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Subject</dt>
                    <dd className="mt-1 text-text-primary">
                      {item.subjectUserId ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Reporter</dt>
                    <dd className="mt-1 text-text-primary">
                      {item.reporterUserId ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Updated</dt>
                    <dd className="mt-1 text-text-primary">
                      {formatStaffDate(item.updatedAt)}
                    </dd>
                  </div>
                </dl>
                {item.reason || item.safeSummary ? (
                  <>
                    <Separator className="my-5" />
                    <p className="text-sm leading-body text-text-secondary">
                      {item.reason ?? item.safeSummary}
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList
                  className="h-4 w-4 text-text-tertiary"
                  aria-hidden
                />
                <h2 className="text-base font-semibold leading-ui text-text-primary">
                  Events
                </h2>
              </div>
              {eventsQuery.isLoading ? (
                <div className="h-40 rounded-md bg-surface-subtle" />
              ) : eventsQuery.isError ? (
                <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
                  Unable to load case events.
                </div>
              ) : (
                <div className="grid gap-3">
                  {(eventsQuery.data ?? []).map((event) => (
                    <Card key={event.id} surface="plain">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium leading-ui text-text-primary">
                            {event.eventType}
                          </div>
                          <time className="text-xs leading-ui text-text-tertiary">
                            {formatStaffDate(event.createdAt)}
                          </time>
                        </div>
                        {event.reason ? (
                          <p className="mt-2 text-sm leading-body text-text-secondary">
                            {event.reason}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-3">
            <h2 className="text-base font-semibold leading-ui text-text-primary">
              Audit
            </h2>
            {auditQuery.isLoading ? (
              <div className="h-32 rounded-md bg-surface-subtle" />
            ) : auditQuery.isError ? (
              <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
                Unable to load audit records.
              </div>
            ) : (auditQuery.data ?? []).length === 0 ? (
              <div className="rounded-md bg-surface-subtle p-4 text-sm leading-body text-text-secondary">
                No linked audit records.
              </div>
            ) : (
              (auditQuery.data ?? []).map((entry) => (
                <Card key={entry.id} surface="plain">
                  <CardContent className="p-4">
                    <div className="text-sm font-medium leading-ui text-text-primary">
                      {entry.action}
                    </div>
                    <p className="mt-1 text-xs leading-ui text-text-tertiary">
                      {formatStaffDate(entry.createdAt)}
                    </p>
                    <p className="mt-2 text-sm leading-body text-text-secondary">
                      {entry.reason}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </aside>
        </section>
      )}
    </StaffPageShell>
  );
}
