import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ShelfContentsSearchSection = lazyRouteComponent(
  () => import("@/user/sections/ShelfContentsSearchSection"),
  "ShelfContentsSearchSection",
);

export const Route = createFileRoute(
  "/_mainLayout/u/$userSlug/profile/shelves_/search",
)({
  component: ShelfContentsSearchSection,
});
