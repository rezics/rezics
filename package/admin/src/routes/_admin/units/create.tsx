import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/units/create")({
  component: lazyRouteComponent(
    () => import("@/unit/page/UnitCreatePage"),
    "default",
  ),
});
