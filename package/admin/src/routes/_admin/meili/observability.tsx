import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const MeiliObservabilityPage = lazyRouteComponent(
  () => import("@/meili/pages/MeiliObservabilityPage"),
  "MeiliObservabilityPage",
);

export const Route = createFileRoute("/_admin/meili/observability")({
  component: MeiliObservabilityPage,
});
