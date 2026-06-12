import {
  governanceCaseListQuery,
  governanceRealmCaseListQuery,
} from "@rezics/api/governance/governance";
import type { ModerationCaseDTO } from "@rezics/contract";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListFilter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RealmSearchField } from "@/shared/ui/RealmSearchField";
import { UserSearchField } from "@/shared/ui/UserSearchField";
import {
  formatStaffDate,
  StaffForbiddenState,
  StaffLoadingState,
  StaffPageShell,
  useStaffConsoleAccess,
} from "./shared";

/**
 * 审查控制台主页面。查看全站审查案件、领域案件流入、并跳转至账户安全记录。
 *
 * 布局结构：
 *
 * Filter Row (md+):
 * ┌────────────────┬─────────────┬─────────────┬──────────┐
 * │ State Select   │ Assignment  │ Target Text │ Account  │
 * │ [Dropdown]     │ [Dropdown]  │ [Input]     │ [Input]  │
 * └────────────────┴─────────────┴─────────────┴──────────┘
 *
 * Site Cases Section:
 * ┌──────────────────────────────────────────────────┐
 * │ Case          │ Target      │ State │ Severity   │
 * │ ─────────────────────────────────────────────── │
 * │ case-123      │ unit:unit-1 │ new   │ high       │
 * │ case-456      │ unit:unit-2 │ open  │ medium     │
 * └──────────────────────────────────────────────────┘
 *
 * Realm Cases Section (when realm ID entered):
 * ┌──────────────────────────────────────────────────┐
 * │ [Card] Realm Case 1                              │
 * │ [Card] Realm Case 2                              │
 * │ [Card] Realm Case 3                              │
 * └──────────────────────────────────────────────────┘
 */
export function StaffConsolePage({
  initialRealmUnitId = "",
  initialAccountUserId = "",
}: {
  initialRealmUnitId?: string;
  initialAccountUserId?: string;
} = {}) {
  const { status, allowed } = useStaffConsoleAccess();
  const [stateFilter, setStateFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("");
  const [realmUnitId, setRealmUnitId] = useState(initialRealmUnitId);
  const [accountUserId, setAccountUserId] = useState(initialAccountUserId);

  const casesQuery = useQuery({
    ...governanceCaseListQuery({ limit: 50 }),
    enabled: allowed,
  });
  const realmCasesQuery = useQuery({
    ...governanceRealmCaseListQuery(realmUnitId, { limit: 25 }),
    enabled: allowed && realmUnitId.trim().length > 0,
  });

  const filteredCases = useMemo(() => {
    return (casesQuery.data ?? []).filter((item) => {
      if (stateFilter !== "all" && item.state !== stateFilter) return false;
      if (assignmentFilter === "assigned" && !item.assignedToUserId) {
        return false;
      }
      if (assignmentFilter === "unassigned" && item.assignedToUserId) {
        return false;
      }
      if (targetFilter.trim()) {
        const needle = targetFilter.trim().toLowerCase();
        const target = `${item.target.kind}:${item.target.id}`.toLowerCase();
        if (!target.includes(needle)) return false;
      }
      return true;
    });
  }, [assignmentFilter, casesQuery.data, stateFilter, targetFilter]);

  if (status === "idle" || status === "loading") return <StaffLoadingState />;
  if (!allowed) return <StaffForbiddenState />;

  return (
    <StaffPageShell
      title="Moderation cases"
      description="Review site cases, check realm case intake, and jump into account safety records."
      actions={
        accountUserId.trim() ? (
          <Link
            to="/staff/account/$targetUserId"
            params={{ targetUserId: accountUserId.trim() }}
          >
            <Button variant="outline">Open account</Button>
          </Link>
        ) : null
      }
    >
      <section className="grid gap-4 md:grid-cols-[1fr_220px]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-state-filter">State</Label>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger id="staff-state-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="triaged">Triaged</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-assignment-filter">Assignment</Label>
            <Select
              value={assignmentFilter}
              onValueChange={setAssignmentFilter}
            >
              <SelectTrigger id="staff-assignment-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="staff-target-filter">Target</Label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <Input
                id="staff-target-filter"
                value={targetFilter}
                onChange={(event) => setTargetFilter(event.target.value)}
                className="pl-9"
                placeholder="post:unit-id"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <UserSearchField
            id="staff-account-id"
            value={accountUserId}
            onChange={setAccountUserId}
            label="Account"
            placeholder="search by name or slug"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-text-tertiary" aria-hidden />
          <h2 className="text-base font-semibold leading-ui text-text-primary">
            Site cases
          </h2>
        </div>
        {casesQuery.isLoading ? (
          <div className="h-56 rounded-md bg-surface-subtle" />
        ) : casesQuery.isError ? (
          <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
            Unable to load cases.
          </div>
        ) : (
          <CaseTable cases={filteredCases} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="max-w-xl">
          <RealmSearchField
            id="staff-realm-id"
            value={realmUnitId}
            onChange={setRealmUnitId}
            label="Realm cases"
            placeholder="search realms by name"
          />
        </div>
        {realmUnitId.trim() ? (
          realmCasesQuery.isLoading ? (
            <div className="h-32 rounded-md bg-surface-subtle" />
          ) : realmCasesQuery.isError ? (
            <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
              Unable to load realm cases.
            </div>
          ) : (
            <RealmCaseList items={realmCasesQuery.data ?? []} />
          )
        ) : null}
      </section>
    </StaffPageShell>
  );
}

function statusBadge(state: string) {
  if (state === "new" || state === "triaged") return "secondary";
  if (state === "resolved" || state === "actioned") return "default";
  return "outline";
}

function CaseTable({ cases }: { cases: ModerationCaseDTO[] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
        No moderation cases match the current view.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Assigned</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link
                  to="/staff/case/$caseId"
                  params={{ caseId: item.id }}
                  className="font-medium text-text-primary underline-offset-2 hover:underline"
                >
                  {item.id}
                </Link>
              </TableCell>
              <TableCell>
                <span className="text-text-secondary">
                  {item.target.kind}:{item.target.id}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={statusBadge(item.state)}>{item.state}</Badge>
              </TableCell>
              <TableCell>{item.severity ?? "—"}</TableCell>
              <TableCell>{item.assignedToUserId ?? "Unassigned"}</TableCell>
              <TableCell>{formatStaffDate(item.updatedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RealmCaseList({ items }: { items: ModerationCaseDTO[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
        No realm cases are available for this realm.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Card key={item.id} surface="plain">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadge(item.state)}>{item.state}</Badge>
                <span className="text-sm font-medium leading-ui text-text-primary">
                  {item.target.kind}:{item.target.id}
                </span>
              </div>
              <p className="mt-2 text-sm leading-body text-text-secondary">
                {item.reason ?? item.safeSummary ?? "No summary recorded."}
              </p>
            </div>
            {item.parentCaseId ? (
              <Link
                to="/staff/case/$caseId"
                params={{ caseId: item.parentCaseId }}
              >
                <Button variant="outline" size="sm">
                  Open case
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
