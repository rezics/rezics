import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const CollectionTabSection = lazyRouteComponent(
  () => import("@/user/sections/CollectionTabSection"),
  "CollectionTabSection",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/collection")({
  component: CollectionTabSection,
});
