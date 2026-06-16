import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageProfilePage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage/profile")({
  component: ZoneManageProfilePage,
});
