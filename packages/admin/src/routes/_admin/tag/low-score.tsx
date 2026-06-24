import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/tag/low-score")({
  component: lazyRouteComponent(
    () => import("@/tag/pages/LowScoreTagsPage"),
    "default",
  ),
});
