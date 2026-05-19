import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookRevisionPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookRevisionPage",
);

export const Route = createFileRoute(
  "/_mainLayout/book/$bookId/history/$sequence",
)({
  component: BookRevisionPage,
});
