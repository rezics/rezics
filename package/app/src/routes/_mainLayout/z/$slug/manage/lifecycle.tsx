import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageLifecyclePage } from "@/zone";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage/lifecycle")({
  component: ZoneManageLifecyclePage,
});
