import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const StatusServicesPage = lazyRouteComponent(
  () => import("@/admin/system-health/pages/StatusServicesPage"),
  "StatusServicesPage",
);

export const Route = createFileRoute("/_admin/status/services")({
  component: StatusServicesPage,
});
