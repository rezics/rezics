import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/realm/")({
  component: lazyRouteComponent(
    () => import("@/realm/pages/RealmsPage"),
    "default",
  ),
});
