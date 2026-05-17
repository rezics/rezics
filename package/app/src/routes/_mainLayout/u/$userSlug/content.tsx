import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ContentTabSection = lazyRouteComponent(
  () => import("@/user/sections/ContentTabSection"),
  "ContentTabSection",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/content")({
  component: ContentTabSection,
});
