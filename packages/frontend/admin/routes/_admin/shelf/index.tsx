import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/shelf/")({
  component: lazyRouteComponent(
    () => import("@/admin/shelf/pages/ShelvesPage"),
    "default",
  ),
});
