import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditHistoryPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookEditHistoryPage",
);

export const Route = createFileRoute("/book_/$bookId/edit/history")({
  component: BookEditHistoryPage,
});
