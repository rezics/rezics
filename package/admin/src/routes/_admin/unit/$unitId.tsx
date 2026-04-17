import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/unit/$unitId")({
  component: lazyRouteComponent(
    () => import("@/unit/pages/UnitEditPage"),
    "default",
  ),
});
