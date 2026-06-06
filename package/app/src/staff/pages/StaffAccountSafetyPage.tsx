import {
  governanceActiveEnforcementQuery,
  governanceAuditListQuery,
  governanceEnforcementListQuery,
} from "@rezics/api/governance/governance";
import { Badge, Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import {
  formatStaffDate,
  StaffForbiddenState,
  StaffLoadingState,
  StaffPageShell,
  useStaffConsoleAccess,
} from "./shared";

export function StaffAccountSafetyPage({
  targetUserId,
}: {
  targetUserId: string;
}) {
  const { status, allowed } = useStaffConsoleAccess();
  const activeQuery = useQuery({
    ...governanceActiveEnforcementQuery(targetUserId),
    enabled: allowed,
  });
  const enforcementQuery = useQuery({
    ...governanceEnforcementListQuery(targetUserId, { limit: 50 }),
    enabled: allowed,
  });
  const auditQuery = useQuery({
    ...governanceAuditListQuery({
      targetKind: "account",
      targetId: targetUserId,
      limit: 25,
    }),
    enabled: allowed,
  });

  if (status === "idle" || status === "loading") return <StaffLoadingState />;
  if (!allowed) return <StaffForbiddenState />;

  return (
    <StaffPageShell
      title="Account safety"
      description="Review active enforcement, historical account decisions, and linked audit entries."
    >
      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card surface="contained">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold leading-ui text-text-primary">
              Current state
            </h2>
            {activeQuery.isLoading ? (
              <div className="mt-4 h-20 rounded-sm bg-surface-subtle" />
            ) : activeQuery.isError ? (
              <p className="mt-4 text-sm leading-body text-error-text">
                Unable to load active enforcement.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <div className="text-xs uppercase leading-ui text-text-tertiary">
                    User
                  </div>
                  <div className="mt-1 text-sm font-medium leading-ui text-text-primary">
                    {targetUserId}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(activeQuery.data?.activeKinds ?? []).length > 0 ? (
                    activeQuery.data?.activeKinds.map((kind) => (
                      <Badge key={kind}>{kind}</Badge>
                    ))
                  ) : (
                    <Badge variant="outline">No active enforcement</Badge>
                  )}
                </div>
                <div className="text-sm leading-body text-text-secondary">
                  Expires {formatStaffDate(activeQuery.data?.expiresAt)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold leading-ui text-text-primary">
            Enforcement history
          </h2>
          {enforcementQuery.isLoading ? (
            <div className="h-56 rounded-md bg-surface-subtle" />
          ) : enforcementQuery.isError ? (
            <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
              Unable to load enforcement records.
            </div>
          ) : (enforcementQuery.data ?? []).length === 0 ? (
            <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
              No enforcement records for this account.
            </div>
          ) : (
            <div className="grid gap-3">
              {(enforcementQuery.data ?? []).map((item) => (
                <Card key={item.id} surface="plain">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{item.kind}</Badge>
                        <Badge variant="outline">{item.state}</Badge>
                      </div>
                      <time className="text-xs leading-ui text-text-tertiary">
                        {formatStaffDate(item.createdAt)}
                      </time>
                    </div>
                    <p className="mt-2 text-sm leading-body text-text-secondary">
                      {item.reason}
                    </p>
                    {item.safeMessage ? (
                      <p className="mt-2 text-sm leading-body text-text-tertiary">
                        {item.safeMessage}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold leading-ui text-text-primary">
          Audit timeline
        </h2>
        {auditQuery.isLoading ? (
          <div className="h-32 rounded-md bg-surface-subtle" />
        ) : auditQuery.isError ? (
          <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
            Unable to load audit records.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(auditQuery.data ?? []).map((entry) => (
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
            ))}
          </div>
        )}
      </section>
    </StaffPageShell>
  );
}
