import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/book/meili")({
  component: lazyRouteComponent(
    () => import("@/book/pages/MeiliBooksPage"),
    "default",
  ),
});
