import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const MediaHomePage = lazyRouteComponent(
  () => import("@/media-library"),
  "MediaHomePage",
);

export const Route = createFileRoute("/_mainLayout/media/")({
  component: MediaHomePage,
});
