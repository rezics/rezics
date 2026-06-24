import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/status")({
  component: lazyRouteComponent(
    () => import("@/admin/auth/pages/AuthStatusPage"),
    "default",
  ),
});
