import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookRouteLoaderData } from "./route";

const BookReviewPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookReviewPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/review")({
  head: ({ matches }) => {
    const data = bookRouteLoaderData(matches);
    return titleMeta(
      data ? titleOfBook(data.book, data.readContext) : null,
      titleLabel("page:book_tabs_reviews"),
    );
  },
  component: BookReviewPage,
});
