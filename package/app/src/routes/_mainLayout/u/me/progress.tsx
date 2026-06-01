import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core/routing/routeBoundaries";

const ProgressLibraryPage = lazyRouteComponent(
  () => import("@/progress"),
  "ProgressLibraryPage",
);

export const Route = createFileRoute("/_mainLayout/u/me/progress")({
  component: ProgressLibraryPage,
  ...routeBoundaries(),
});
