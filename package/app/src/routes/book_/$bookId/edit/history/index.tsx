import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditHistoryTimelinePage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookEditHistoryTimelinePage",
);

export const Route = createFileRoute("/book_/$bookId/edit/history/")({
  component: BookEditHistoryTimelinePage,
});
