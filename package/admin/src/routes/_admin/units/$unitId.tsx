import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/units/$unitId")({
  component: lazyRouteComponent(
    () => import("@/unit/page/UnitEditPage"),
    "default",
  ),
});
