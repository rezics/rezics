import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const FollowersTabSection = lazyRouteComponent(
  () => import("@/user/section/FollowersTabSection"),
  "FollowersTabSection",
);

export const Route = createFileRoute("/_mainLayout/user/$unitId/followers")({
  component: FollowersTabSection,
});
