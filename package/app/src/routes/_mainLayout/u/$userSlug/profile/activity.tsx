import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core";

const ActivityTabSection = lazyRouteComponent(
  () => import("@/user/sections/ActivityTabSection"),
  "ActivityTabSection",
);

export const Route = createFileRoute(
  "/_mainLayout/u/$userSlug/profile/activity",
)({
  component: ActivityTabSection,
  ...routeBoundaries(),
});
