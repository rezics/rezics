import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/users")({
  component: lazyRouteComponent(
    () => import("@/admin/auth/pages/AuthUsersPage"),
    "default",
  ),
});
