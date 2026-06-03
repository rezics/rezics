import { createFileRoute } from "@tanstack/react-router";
import { StaffCaseDetailPage } from "@/staff";

export const Route = createFileRoute("/_mainLayout/staff/case/$caseId")({
  component: StaffCaseRoute,
});

function StaffCaseRoute() {
  const { caseId } = Route.useParams();
  return <StaffCaseDetailPage caseId={caseId} />;
}
