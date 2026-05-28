import { governanceAuditListQuery } from "@rezics/api/governance/governance";
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
import {
  formatStaffDate,
  StaffForbiddenState,
  StaffLoadingState,
  StaffPageShell,
  useStaffConsoleAccess,
} from "./shared";

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

  const query = useMemo(
    () => ({
      limit: 50,
      ...(action.trim() ? { action: action.trim() } : {}),
      ...(targetKind.trim() ? { targetKind: targetKind.trim() } : {}),
      ...(targetId.trim() ? { targetId: targetId.trim() } : {}),
    }),
    [action, targetId, targetKind],
  );
  const auditQuery = useQuery({
    ...governanceAuditListQuery(query),
    enabled: allowed,
  });

  if (status === "idle" || status === "loading") return <StaffLoadingState />;
  if (!allowed) return <StaffForbiddenState />;

  return (
    <StaffPageShell
      title="Audit timeline"
      description="Inspect redacted privileged-action audit records."
    >
      <section className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="staff-audit-action">Action</Label>
          <Input
            id="staff-audit-action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="account.enforcement.applied"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="staff-audit-target-kind">Target kind</Label>
          <Input
            id="staff-audit-target-kind"
            value={targetKind}
            onChange={(event) => setTargetKind(event.target.value)}
            placeholder="account"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="staff-audit-target-id">Target id</Label>
          <Input
            id="staff-audit-target-id"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            placeholder="target id"
          />
        </div>
      </section>

      {auditQuery.isLoading ? (
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
