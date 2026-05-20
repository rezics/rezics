import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookRevisionComparePage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookRevisionComparePage",
);

export const Route = createFileRoute(
  "/_mainLayout/book/$bookId/history/compare/$targetSequence",
)({
  component: BookRevisionComparePage,
});
