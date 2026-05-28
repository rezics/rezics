import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RepairJobsPage = lazyRouteComponent(
  () => import("@/repair/pages/RepairJobsPage"),
);

export const Route = createFileRoute("/_admin/repair")({
  component: RepairJobsPage,
});
