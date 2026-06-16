import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const FollowersTabSection = lazyRouteComponent(
  () => import("@/user/sections/FollowersTabSection"),
  "FollowersTabSection",
);

export const Route = createFileRoute(
  "/_mainLayout/user/$userId/profile/followers",
)({
  component: FollowersTabSection,
});
