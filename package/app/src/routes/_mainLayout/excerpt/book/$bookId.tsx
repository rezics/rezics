import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ExcerptByBookPage = lazyRouteComponent(
  () => import("@/excerpt/pages/ExcerptByBookPage"),
  "ExcerptByBookPage",
);

export const Route = createFileRoute("/_mainLayout/excerpt/book/$bookId")({
  component: ExcerptByBookPage,
});
