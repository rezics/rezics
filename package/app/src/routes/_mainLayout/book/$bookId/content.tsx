import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookRouteLoaderData } from "./route";

const BookContentPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookContentPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/content")({
  head: ({ matches }) => {
    const data = bookRouteLoaderData(matches);
    return titleMeta(
      data ? titleOfBook(data.book, data.readContext) : null,
      titleLabel("page:book_tabs_content"),
    );
  },
  component: BookContentPage,
});
