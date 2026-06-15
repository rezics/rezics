import { createFileRoute } from "@tanstack/react-router";
import { BookCommunityPage } from "@/book-library";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookChildRouteLoader } from "./route";

export const Route = createFileRoute("/_mainLayout/book/$bookId/discussion")({
  loader: bookChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfBook(loaderData.book, loaderData.readContext),
      await resolveTitleLabel("page:book_tabs_community"),
    ),
  component: BookCommunityPage,
});
