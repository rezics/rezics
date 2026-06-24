import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/user/")({
  component: lazyRouteComponent(
    () => import("@/user/pages/MeiliUsersPage"),
    "default",
  ),
});
