import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const StatusQueuePage = lazyRouteComponent(
  () => import("@/admin/system-health/pages/StatusQueuePage"),
  "StatusQueuePage",
);

export const Route = createFileRoute("/_admin/status/queue")({
  component: StatusQueuePage,
});
