import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageProfilePage } from "@/zone";

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/manage/profile",
)({
  component: ZoneManageProfilePage,
});
