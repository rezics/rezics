import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/users/meili")({
  component: lazyRouteComponent(
    () => import("@/user/page/MeiliUsersPage"),
    "default",
  ),
});
