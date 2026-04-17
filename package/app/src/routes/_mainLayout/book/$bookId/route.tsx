import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";

const BookDetailLayout = lazyRouteComponent(
  () => import("@/book-library"),
  "BookDetailLayout",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId")({
  component: () => (
    <BookDetailLayout>
      <Outlet />
    </BookDetailLayout>
  ),
  notFoundComponent: lazyRouteComponent(
    () => import("@/core/pages/NotFound"),
    "NotFoundContainer",
  ),
});
