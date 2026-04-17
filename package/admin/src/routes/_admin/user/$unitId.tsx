import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/user/$unitId")({
  component: lazyRouteComponent(
    () => import("@/user/pages/UserEditPage"),
    "default",
  ),
});
