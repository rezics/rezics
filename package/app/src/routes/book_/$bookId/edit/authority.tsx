import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookAuthorityPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookAuthorityPage",
);

export const Route = createFileRoute("/book_/$bookId/edit/authority")({
  component: BookAuthorityPage,
});
