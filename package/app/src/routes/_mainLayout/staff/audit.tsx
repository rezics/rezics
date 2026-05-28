import { StaffAuditPage } from "@/staff";
import { createFileRoute } from "@tanstack/react-router";

type StaffAuditSearch = {
  action?: string;
  targetKind?: string;
  targetId?: string;
};

export const Route = createFileRoute("/_mainLayout/staff/audit")({
  validateSearch: (search: Record<string, unknown>): StaffAuditSearch => ({
    action: typeof search.action === "string" ? search.action : undefined,
    targetKind:
      typeof search.targetKind === "string" ? search.targetKind : undefined,
    targetId: typeof search.targetId === "string" ? search.targetId : undefined,
  }),
  component: StaffAuditRoute,
});

function StaffAuditRoute() {
  const search = Route.useSearch();
  return (
    <StaffAuditPage
      initialAction={search.action}
      initialTargetKind={search.targetKind}
      initialTargetId={search.targetId}
    />
  );
}
