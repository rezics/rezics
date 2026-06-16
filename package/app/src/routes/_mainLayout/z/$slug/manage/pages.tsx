import { createFileRoute } from "@tanstack/react-router";
import { ZoneManagePagesPage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage/pages")({
  component: ZoneManagePagesPage,
});
