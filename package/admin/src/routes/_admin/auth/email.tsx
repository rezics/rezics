import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/email")({
  component: lazyRouteComponent(
    () => import("@/auth/pages/AuthEmailPage"),
    "default",
  ),
});
