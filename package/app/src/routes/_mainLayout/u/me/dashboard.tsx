import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const DashboardPage = lazyRouteComponent(
  () => import("@/dashboard"),
  "DashboardPage",
);

export const Route = createFileRoute("/_mainLayout/u/me/dashboard")({
  component: DashboardPage,
});
