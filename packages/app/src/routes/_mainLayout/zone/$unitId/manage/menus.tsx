import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageMenusPage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/zone/$unitId/manage/menus")({
  component: ZoneManageMenusPage,
});
