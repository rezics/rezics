import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageMenusPage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage/menus")({
  component: ZoneManageMenusPage,
});
