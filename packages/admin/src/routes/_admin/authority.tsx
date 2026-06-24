import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/authority")({
  component: lazyRouteComponent(
    () => import("@/authority/pages/AuthorityOpsPage"),
    "default",
  ),
});
