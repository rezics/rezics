import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookHomePage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookHomePage",
);

export const Route = createFileRoute("/_mainLayout/book/")({
  component: BookHomePage,
});
