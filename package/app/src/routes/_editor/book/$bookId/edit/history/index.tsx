import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditHistoryTimelinePage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookEditHistoryTimelinePage",
);

export const Route = createFileRoute("/_editor/book/$bookId/edit/history/")({
  component: BookEditHistoryTimelinePage,
});
