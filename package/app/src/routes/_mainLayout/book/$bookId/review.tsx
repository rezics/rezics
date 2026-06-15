import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookChildRouteLoader } from "./route";

const BookReviewPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookReviewPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/review")({
  loader: bookChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfBook(loaderData.book, loaderData.readContext),
      await resolveTitleLabel("page:book_tabs_reviews"),
    ),
  component: BookReviewPage,
});
