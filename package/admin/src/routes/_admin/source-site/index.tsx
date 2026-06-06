import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/source-site/")({
  component: lazyRouteComponent(
    () => import("@/source-site/pages/SourceSitesPage"),
    "default",
  ),
});
