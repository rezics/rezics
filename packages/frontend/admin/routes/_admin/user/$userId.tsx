import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/user/$userId")({
  component: lazyRouteComponent(
    () => import("@/admin/user/pages/UserEditPage"),
    "default",
  ),
});
