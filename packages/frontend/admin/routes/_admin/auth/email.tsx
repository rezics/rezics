import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/email")({
  component: lazyRouteComponent(
    () => import("@/admin/auth/pages/AuthEmailPage"),
    "default",
  ),
});
