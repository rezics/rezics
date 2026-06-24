import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/governance/")({
  component: lazyRouteComponent(
    () => import("@/admin/governance/pages/GovernanceOverviewPage"),
    "default",
  ),
});
