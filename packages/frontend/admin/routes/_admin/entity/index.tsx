import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/entity/")({
  component: lazyRouteComponent(
    () => import("@/admin/entity/pages/EntityListPage"),
    "default",
  ),
});
