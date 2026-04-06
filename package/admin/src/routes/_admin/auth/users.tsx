import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/auth/users")({
  component: lazyRouteComponent(
    () => import("@/auth/page/AuthUsersPage"),
    "default",
  ),
});
