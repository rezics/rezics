import { createFileRoute } from "@tanstack/react-router";
import { ZoneManagePagesPage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/zone/$unitId/manage/pages")({
  component: ZoneManagePagesPage,
});
