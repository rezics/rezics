import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageThemePage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage/theme")({
  component: ZoneManageThemePage,
});
