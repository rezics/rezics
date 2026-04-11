import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/shelves/")({
  component: lazyRouteComponent(
    () => import("@/shelf/page/ShelvesPage"),
    "default",
  ),
});
