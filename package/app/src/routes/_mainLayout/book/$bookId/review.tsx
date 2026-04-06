import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookReviewPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookReviewPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/review")({
  component: BookReviewPage,
});
