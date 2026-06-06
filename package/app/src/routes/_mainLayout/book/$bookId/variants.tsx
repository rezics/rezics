import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookVariantsPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookVariantsPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/variants")({
  component: BookVariantsPage,
});
