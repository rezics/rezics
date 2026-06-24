import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/user/meili")({
  component: lazyRouteComponent(
    () => import("@/admin/user/pages/MeiliUsersPage"),
    "default",
  ),
});
