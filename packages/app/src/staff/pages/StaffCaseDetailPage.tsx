import {
  governanceCaseActionsQuery,
  governanceCaseDetailQuery,
} from "@rezics/contract/api/governance/governance.queries";
import type { ModerationActionDTO } from "@rezics/contract";
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

/**
 * 审查案件详情页面。展示案件状态及附加的审查账本操作列表。
 *
 * 布局结构：
 *
 * Case Header:
 * ┌────────────────────────────────────────┐
 * │ [Badge: state]                         │
 * │ [Badge: severity] [Badge: assigned]    │
 * │ Target: unit:unit-id                   │
 * │ Subject: user-123                      │
 * │ Reporter: user-456                     │
 * │ Updated: 2024-01-15                    │
 * ├────────────────────────────────────────┤
 * │ Case reason or summary text...         │
 * └────────────────────────────────────────┘
 *
 * Desktop & Tablet:
 * ┌────────────────────────────────────────┐
 * │ Ledger Actions (grid, 1 column)        │
 * │ ─────────────────────────────────────  │
 * │ [Action Card] [Action Card]            │
 * │ [Action Card] [Action Card]            │
 * └────────────────────────────────────────┘
 *
 * Mobile:
 * ┌──────────────────────┐
 * │ Case Header (full)   │
 * │ Ledger (stacked)     │
 * │ [Action Card]        │
 * │ [Action Card]        │
 * └──────────────────────┘
 */
export function StaffCaseDetailPage({ caseId }: { caseId: string }) {
  const { status, allowed } = useStaffConsoleAccess();
  const caseQuery = useQuery({
    ...governanceCaseDetailQuery(caseId),
    enabled: allowed,
  });
  const actionsQuery = useQuery({
    ...governanceCaseActionsQuery(caseId, { limit: 50 }),
    enabled: allowed,
  });

  if (status === "idle" || status === "loading") return <StaffLoadingState />;
  if (!allowed) return <StaffForbiddenState />;

  const item = caseQuery.data;

  return (
    <StaffPageShell
      title="Case detail"
      description="Inspect case state and the moderation ledger actions attached to it."
    >
      {caseQuery.isLoading ? (
        <div className="h-48 rounded-md bg-surface-subtle" />
      ) : caseQuery.isError || !item ? (
        <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
          Unable to load this moderation case.
        </div>
      ) : (
        <section className="flex flex-col gap-4">
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
                Ledger
              </h2>
            </div>
            {actionsQuery.isLoading ? (
              <div className="h-40 rounded-md bg-surface-subtle" />
            ) : actionsQuery.isError ? (
              <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
                Unable to load ledger actions.
              </div>
            ) : (actionsQuery.data ?? []).length === 0 ? (
              <div className="rounded-md bg-surface-subtle p-4 text-sm leading-body text-text-secondary">
                No ledger actions attached to this case.
              </div>
            ) : (
              <div className="grid gap-3">
                {(actionsQuery.data ?? []).map((event) => (
                  <ModerationActionCard key={event.id} action={event} />
                ))}
              </div>
            )}
          </section>
        </section>
      )}
    </StaffPageShell>
  );
}

function ModerationActionCard({ action }: { action: ModerationActionDTO }) {
  return (
    <Card surface="plain">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{action.actionKind}</Badge>
            <Badge variant="outline">{action.authority}</Badge>
            {action.resultingStatus ? (
              <Badge variant="secondary">{action.resultingStatus}</Badge>
            ) : null}
            {action.resultingLocked !== null &&
            action.resultingLocked !== undefined ? (
              <Badge variant="outline">
                {action.resultingLocked ? "locked" : "unlocked"}
              </Badge>
            ) : null}
          </div>
          <time className="text-xs leading-ui text-text-tertiary">
            {formatStaffDate(action.createdAt)}
          </time>
        </div>
        <dl className="mt-3 grid gap-2 text-xs leading-ui text-text-tertiary md:grid-cols-2">
          <div>
            <dt>Target</dt>
            <dd className="mt-1 text-text-secondary">
              {action.targetKind}:{action.targetId}
            </dd>
          </div>
          <div>
            <dt>Actor</dt>
            <dd className="mt-1 text-text-secondary">
              {action.actorUserId ?? action.actorKind}
            </dd>
          </div>
        </dl>
        {action.reasonText ? (
          <p className="mt-3 text-sm leading-body text-text-secondary">
            {action.reasonText}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
