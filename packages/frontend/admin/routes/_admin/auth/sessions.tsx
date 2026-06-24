import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/sessions")({
  component: lazyRouteComponent(
    () => import("@/admin/auth/pages/AuthSessionsPage"),
    "default",
  ),
});
