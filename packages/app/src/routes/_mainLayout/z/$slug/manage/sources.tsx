import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageSourcesPage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage/sources")({
  component: ZoneManageSourcesPage,
});
