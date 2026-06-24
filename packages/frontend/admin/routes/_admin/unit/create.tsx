import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/unit/create")({
  component: lazyRouteComponent(
    () => import("@/admin/unit/pages/UnitCreatePage"),
    "default",
  ),
});
