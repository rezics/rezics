import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/unit/$unitId")({
  component: lazyRouteComponent(
    () => import("@/admin/unit/pages/UnitEditPage"),
    "default",
  ),
});
