import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core";

const FollowersTabSection = lazyRouteComponent(
  () => import("@/user/sections/FollowersTabSection"),
  "FollowersTabSection",
);

export const Route = createFileRoute(
  "/_mainLayout/u/$userSlug/profile/followers",
)({
  component: FollowersTabSection,
  ...routeBoundaries(),
});
