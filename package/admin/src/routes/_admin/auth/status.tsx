import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/status")({
  component: lazyRouteComponent(
    () => import("@/auth/pages/AuthStatusPage"),
    "default",
  ),
});
