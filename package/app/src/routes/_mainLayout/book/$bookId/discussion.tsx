import { createFileRoute } from "@tanstack/react-router";
import { BookCommunityPage } from "@/book-library";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
import { bookChildRouteLoader } from "./route";

export const Route = createFileRoute("/_mainLayout/book/$bookId/discussion")({
  loader: bookChildRouteLoader,
  head: ({ loaderData }) =>
    unitTitleMeta("book", titleOfBook(loaderData.book, loaderData.readContext)),
  component: BookCommunityPage,
});
