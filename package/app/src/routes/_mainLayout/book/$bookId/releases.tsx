import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookReleasesPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookReleasesPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/releases")({
  component: BookReleasesPage,
});
