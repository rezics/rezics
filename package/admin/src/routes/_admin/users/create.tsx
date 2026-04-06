import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/users/create")({
  component: lazyRouteComponent(
    () => import("@/user/page/UserCreatePage"),
    "default",
  ),
});
