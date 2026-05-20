import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookHistoryPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookHistoryPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/history/")({
  component: BookHistoryPage,
});
