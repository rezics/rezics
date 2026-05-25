import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/entity/$unitId")({
  component: lazyRouteComponent(
    () => import("@/entity/pages/EntityEditPage"),
    "default",
  ),
});
