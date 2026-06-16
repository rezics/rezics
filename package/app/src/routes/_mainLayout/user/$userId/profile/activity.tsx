import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ActivityTabSection = lazyRouteComponent(
  () => import("@/user/sections/ActivityTabSection"),
  "ActivityTabSection",
);

export const Route = createFileRoute(
  "/_mainLayout/user/$userId/profile/activity",
)({
  component: ActivityTabSection,
});
