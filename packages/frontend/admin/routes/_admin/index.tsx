import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/")({
  component: lazyRouteComponent(
    () => import("@/admin/home/pages/DashboardPage"),
    "default",
  ),
});
