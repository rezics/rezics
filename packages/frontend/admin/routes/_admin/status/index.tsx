import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const StatusPage = lazyRouteComponent(
  () => import("@/admin/system-health/pages/StatusPage"),
  "StatusPage",
);

export const Route = createFileRoute("/_admin/status/")({
  component: StatusPage,
});
