import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/entities/")({
  component: lazyRouteComponent(
    () => import("@/entity/pages/EntityListPage"),
    "default",
  ),
});
