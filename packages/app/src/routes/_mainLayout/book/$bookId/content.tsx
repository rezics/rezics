import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
import { bookChildRouteLoader } from "./route";

const BookContentPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookContentPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/content")({
  loader: bookChildRouteLoader,
  head: ({ loaderData }) =>
    unitTitleMeta("book", titleOfBook(loaderData.book, loaderData.readContext)),
  component: BookContentPage,
});
