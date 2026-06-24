import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const StatusCdcPage = lazyRouteComponent(
  () => import("@/admin/system-health/pages/StatusCdcPage"),
  "StatusCdcPage",
);

export const Route = createFileRoute("/_admin/status/cdc")({
  component: StatusCdcPage,
});
