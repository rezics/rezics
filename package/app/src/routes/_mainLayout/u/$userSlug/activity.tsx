import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core/routing/routeBoundaries";

const ActivityTabSection = lazyRouteComponent(
  () => import("@/user/sections/ActivityTabSection"),
  "ActivityTabSection",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/activity")({
  component: ActivityTabSection,
  ...routeBoundaries(),
});
