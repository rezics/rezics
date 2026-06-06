import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core/routing/routeBoundaries";

const DraftsPage = lazyRouteComponent(() => import("@/draft"), "DraftsPage");

export const Route = createFileRoute("/_mainLayout/u/me/drafts")({
  component: DraftsPage,
  ...routeBoundaries(),
});
