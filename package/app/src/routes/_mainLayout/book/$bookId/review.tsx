import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
import { bookChildRouteLoader } from "./route";

const BookReviewPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookReviewPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/review")({
  loader: bookChildRouteLoader,
  head: ({ loaderData }) =>
    unitTitleMeta("book", titleOfBook(loaderData.book, loaderData.readContext)),
  component: BookReviewPage,
});
