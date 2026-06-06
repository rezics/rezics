import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookContentPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookContentPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/content")({
  component: BookContentPage,
});
