import { StaffAccountSafetyPage } from "@/staff";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_mainLayout/staff/account/$targetUserId",
)({
  component: StaffAccountRoute,
});

function StaffAccountRoute() {
  const { targetUserId } = Route.useParams();
  return <StaffAccountSafetyPage targetUserId={targetUserId} />;
}
