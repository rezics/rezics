import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageSourcesPage } from "@/zone";

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/manage/sources",
)({
  component: ZoneManageSourcesPage,
});
