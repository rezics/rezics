import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/source-site/$entityUnitId")({
  component: lazyRouteComponent(
    () => import("@/source-site/pages/SourceSiteDetailPage"),
    "default",
  ),
});
