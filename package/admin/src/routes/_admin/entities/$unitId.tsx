import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/entities/$unitId")({
  component: lazyRouteComponent(
    () => import("@/entity/pages/EntityEditPage"),
    "default",
  ),
});
