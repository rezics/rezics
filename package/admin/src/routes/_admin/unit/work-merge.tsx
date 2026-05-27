import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/unit/work-merge")({
  component: lazyRouteComponent(
    () => import("@/unit/pages/WorkMergePage"),
    "default",
  ),
});
