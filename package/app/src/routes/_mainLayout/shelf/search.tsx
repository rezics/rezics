import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ShelfSearchPage = lazyRouteComponent(
  () => import("@/shelf/pages/ShelfSearchPage"),
  "ShelfSearchPage",
);

export const Route = createFileRoute("/_mainLayout/shelf/search")({
  component: ShelfSearchPage,
});
