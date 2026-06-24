import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/user/create")({
  component: lazyRouteComponent(
    () => import("@/admin/user/pages/UserCreatePage"),
    "default",
  ),
});
