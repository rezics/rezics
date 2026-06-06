import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/entity/")({
  component: lazyRouteComponent(
    () => import("@/entity/pages/EntityListPage"),
    "default",
  ),
});
