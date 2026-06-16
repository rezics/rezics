import { createFileRoute } from "@tanstack/react-router";
import { BookCommunityPage } from "@/book-library";
import {
  titleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookRouteLoaderData } from "./route";

export const Route = createFileRoute("/_mainLayout/book/$bookId/discussion")({
  head: ({ matches }) => {
    const data = bookRouteLoaderData(matches);
    return titleMeta(
      data ? titleOfBook(data.book, data.readContext) : null,
      titleLabel("page:book_tabs_community"),
    );
  },
  component: BookCommunityPage,
});
