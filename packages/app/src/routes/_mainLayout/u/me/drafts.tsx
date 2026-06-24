import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core";

const DraftsPage = lazyRouteComponent(() => import("@/draft"), "DraftsPage");

export const Route = createFileRoute("/_mainLayout/u/me/drafts")({
  component: DraftsPage,
  ...routeBoundaries(),
});
