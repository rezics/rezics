import { createFileRoute } from "@tanstack/react-router";
import { StaffAccountSafetyPage } from "@/staff";

export const Route = createFileRoute(
  "/_mainLayout/staff/account/$targetUserId",
)({
  component: StaffAccountRoute,
});

function StaffAccountRoute() {
  const { targetUserId } = Route.useParams();
  return <StaffAccountSafetyPage targetUserId={targetUserId} />;
}
