import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ShelfContentsSearchSection = lazyRouteComponent(
  () => import("@/user/sections/ShelfContentsSearchSection"),
  "ShelfContentsSearchSection",
);

export const Route = createFileRoute(
  "/_mainLayout/u/$userSlug/profile/shelf/items",
)({
  component: ShelfContentsSearchSection,
});
