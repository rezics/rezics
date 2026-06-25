import {
  governanceAuditListQuery,
  governanceTargetActionsQuery,
} from "@rezics/contract/api/governance/governance.queries";
import type { ModerationActionDTO } from "@rezics/contract";
import {
  Badge,
  Card,
  CardContent,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { UserSearchField } from "@/shared/ui/UserSearchField";
import {
  formatStaffDate,
  StaffForbiddenState,
  StaffLoadingState,
  StaffPageShell,
  useStaffConsoleAccess,
} from "./shared";

/**
 * 审计时间线页面。检查特权审计记录或目标范围的审查账本操作。
 *
 * 布局结构：
 *
 * Filter Bar (3 cols on md+):
 * ┌────────────┬────────────┬────────────┐
 * │  Action    │Target Kind │ Target ID  │
 * │ [Input]    │ [Input]    │ [Input]    │
 * └────────────┴────────────┴────────────┘
 *
 * Desktop (lg):
 * ┌──────────────────────────┬─────────────┐
 * │ Table (scrollable)       │ Latest      │
 * │ ──────────────────────── │ Reasons     │
 * │ [Header]                 │ ─────────── │
 * │ [Row] [Row] [Row] ...    │ [Card]      │
 * │ [Row] [Row] [Row] ...    │ [Card]      │
 * │                          │ [Card]      │
 * └──────────────────────────┴─────────────┘
 *
 * Tablet (md):
 * ┌──────────────────────────────────────┐
 * │ Table (scrollable, full width)       │
 * │ ──────────────────────────────────── │
 * │ [Header]                             │
 * │ [Row] [Row] [Row] ...                │
 * │ [Row] [Row] [Row] ...                │
 * └──────────────────────────────────────┘
 *
 * Mobile:
 * ┌──────────────────────────┐
 * │ Table (horizontal scroll)│
 * └──────────────────────────┘
 */
export function StaffAuditPage({
  initialAction = "",
  initialTargetKind = "",
  initialTargetId = "",
}: {
  initialAction?: string;
  initialTargetKind?: string;
  initialTargetId?: string;
} = {}) {
  const { status, allowed } = useStaffConsoleAccess();
  const [action, setAction] = useState(initialAction);
  const [targetKind, setTargetKind] = useState(initialTargetKind);
  const [targetId, setTargetId] = useState(initialTargetId);
  const actionFilter = action.trim();
  const targetKindFilter = targetKind.trim();
  const targetIdFilter = targetId.trim();
  const usesModerationLedger = Boolean(targetKindFilter && targetIdFilter);

  const query = useMemo(
    () => ({
      limit: 50,
      ...(actionFilter ? { action: actionFilter } : {}),
      ...(targetKindFilter ? { targetKind: targetKindFilter } : {}),
      ...(targetIdFilter ? { targetId: targetIdFilter } : {}),
    }),
    [actionFilter, targetIdFilter, targetKindFilter],
  );
  const auditQuery = useQuery({
    ...governanceAuditListQuery(query),
    enabled: allowed && !usesModerationLedger,
  });
  const ledgerQuery = useQuery({
    ...governanceTargetActionsQuery(targetKindFilter, targetIdFilter, {
      limit: 50,
    }),
    enabled: allowed && usesModerationLedger,
  });
  const ledgerActions = useMemo(
    () =>
      (ledgerQuery.data ?? []).filter((entry) =>
        actionFilter ? entry.actionKind === actionFilter : true,
      ),
    [actionFilter, ledgerQuery.data],
  );

  if (status === "idle" || status === "loading") return <StaffLoadingState />;
  if (!allowed) return <StaffForbiddenState />;

  return (
    <StaffPageShell
      title="Audit timeline"
      description="Inspect privileged audit records, or target-scoped moderation ledger actions when a target is selected."
    >
      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="staff-audit-action">Action</Label>
          <Input
            id="staff-audit-action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder={
              usesModerationLedger ? "remove" : "account.enforcement.applied"
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="staff-audit-target-kind">Target kind</Label>
          <Input
            id="staff-audit-target-kind"
            value={targetKind}
            onChange={(event) => setTargetKind(event.target.value)}
            placeholder="unit, comment, or account"
          />
        </div>
        <div className="flex flex-col gap-1">
          {targetKind.trim() === "account" ? (
            // Account target: pick a user by search. 账户目标：通过搜索选择用户。
            <UserSearchField
              id="staff-audit-target-id"
              value={targetId}
              onChange={setTargetId}
              label="Target id"
              placeholder="search by name or slug"
            />
          ) : (
            // Other target kinds: raw id input. 其他目标类型：原始 id 输入框。
            <>
              <Label htmlFor="staff-audit-target-id">Target id</Label>
              <Input
                id="staff-audit-target-id"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                placeholder="target id"
              />
            </>
          )}
        </div>
      </section>

      {usesModerationLedger ? (
        <ModerationLedgerTable
          actions={ledgerActions}
          isLoading={ledgerQuery.isLoading}
          isError={ledgerQuery.isError}
        />
      ) : auditQuery.isLoading ? (
        <div className="h-64 rounded-md bg-surface-subtle" />
      ) : auditQuery.isError ? (
        <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
          Unable to load audit records.
        </div>
      ) : (auditQuery.data ?? []).length === 0 ? (
        <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
          No audit records match the current filters.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(auditQuery.data ?? []).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.action}
                    </TableCell>
                    <TableCell>
                      {entry.targetKind}:{entry.targetId}
                    </TableCell>
                    <TableCell>{entry.actorUserId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.decisionCode}</Badge>
                    </TableCell>
                    <TableCell>{formatStaffDate(entry.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <aside className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-text-tertiary" aria-hidden />
              <h2 className="text-base font-semibold leading-ui text-text-primary">
                Latest reasons
              </h2>
            </div>
            {(auditQuery.data ?? []).slice(0, 6).map((entry) => (
              <Card key={entry.id} surface="plain">
                <CardContent className="p-4">
                  <div className="text-sm font-medium leading-ui text-text-primary">
                    {entry.action}
                  </div>
                  <p className="mt-2 text-sm leading-body text-text-secondary">
                    {entry.reason}
                  </p>
                </CardContent>
              </Card>
            ))}
          </aside>
        </div>
      )}
    </StaffPageShell>
  );
}

function ModerationLedgerTable({
  actions,
  isError,
  isLoading,
}: {
  actions: ModerationActionDTO[];
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="h-64 rounded-md bg-surface-subtle" />;
  }

  if (isError) {
    return (
      <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
        Unable to load moderation ledger actions.
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
        No moderation ledger actions match the current filters.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Authority</TableHead>
              <TableHead>Result</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">
                  {entry.actionKind}
                </TableCell>
                <TableCell>
                  {entry.targetKind}:{entry.targetId}
                </TableCell>
                <TableCell>{entry.actorUserId ?? entry.actorKind}</TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.authority}</Badge>
                </TableCell>
                <TableCell>
                  <ModerationActionResult action={entry} />
                </TableCell>
                <TableCell>{formatStaffDate(entry.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <aside className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-text-tertiary" aria-hidden />
          <h2 className="text-base font-semibold leading-ui text-text-primary">
            Latest reasons
          </h2>
        </div>
        {actions.slice(0, 6).map((entry) => (
          <Card key={entry.id} surface="plain">
            <CardContent className="p-4">
              <div className="text-sm font-medium leading-ui text-text-primary">
                {entry.actionKind}
              </div>
              <p className="mt-2 text-sm leading-body text-text-secondary">
                {entry.reasonText ?? "No reason recorded."}
              </p>
            </CardContent>
          </Card>
        ))}
      </aside>
    </div>
  );
}

function ModerationActionResult({ action }: { action: ModerationActionDTO }) {
  if (action.resultingStatus) {
    return <Badge variant="secondary">{action.resultingStatus}</Badge>;
  }

  if (action.resultingLocked !== null && action.resultingLocked !== undefined) {
    return (
      <Badge variant="outline">
        {action.resultingLocked ? "locked" : "unlocked"}
      </Badge>
    );
  }

  return <span className="text-text-tertiary">No state change</span>;
}
