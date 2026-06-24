import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/unit/")({
  component: lazyRouteComponent(
    () => import("@/admin/unit/pages/MeiliUnitsPage"),
    "default",
  ),
});
