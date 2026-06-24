import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReactionsTabSection = lazyRouteComponent(
  () => import("@/user/sections/ReactionsTabSection"),
  "ReactionsTabSection",
);

export const Route = createFileRoute(
  "/_mainLayout/u/$userSlug/profile/reactions",
)({
  component: ReactionsTabSection,
});
