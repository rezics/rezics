import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const StatusHistoryPage = lazyRouteComponent(
  () => import("@/system-health/pages/StatusHistoryPage"),
  "StatusHistoryPage",
);

export const Route = createFileRoute("/_admin/status/history")({
  component: StatusHistoryPage,
});
