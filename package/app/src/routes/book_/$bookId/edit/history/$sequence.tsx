import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookRevisionPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookRevisionPage",
);

export const Route = createFileRoute("/book_/$bookId/edit/history/$sequence")({
  component: BookRevisionPage,
});
