import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/user/$userId")({
  component: lazyRouteComponent(
    () => import("@/user/pages/UserEditPage"),
    "default",
  ),
});
