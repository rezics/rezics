import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookRevisionPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookRevisionPage",
);

export const Route = createFileRoute(
  "/_editor/book/$bookId/edit/history/$sequence",
)({
  component: BookRevisionPage,
});
