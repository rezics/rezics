import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageThemePage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/zone/$unitId/manage/theme")({
  component: ZoneManageThemePage,
});
