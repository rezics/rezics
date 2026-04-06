import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/sessions")({
  component: lazyRouteComponent(
    () => import("@/auth/page/AuthSessionsPage"),
    "default",
  ),
});
