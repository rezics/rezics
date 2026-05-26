import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookAuthorityPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookAuthorityPage",
);

export const Route = createFileRoute("/_editor/book/$bookId/edit/authority")({
  component: BookAuthorityPage,
});
