import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/realms/")({
  component: lazyRouteComponent(
    () => import("@/realm/page/RealmsPage"),
    "default",
  ),
});
