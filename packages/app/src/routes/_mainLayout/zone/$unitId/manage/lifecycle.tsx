import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageLifecyclePage } from "@/zone";

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/manage/lifecycle",
)({
  component: ZoneManageLifecyclePage,
});
