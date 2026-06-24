import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ShelfContentsSearchSection = lazyRouteComponent(
  () => import("@/user/sections/ShelfContentsSearchSection"),
  "ShelfContentsSearchSection",
);

export const Route = createFileRoute(
  "/_mainLayout/user/$userId/profile/shelf/items",
)({
  component: ShelfContentsSearchSection,
});
