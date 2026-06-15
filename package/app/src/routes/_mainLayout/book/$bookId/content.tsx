import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookChildRouteLoader } from "./route";

const BookContentPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookContentPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/content")({
  loader: bookChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfBook(loaderData.book, loaderData.readContext),
      await resolveTitleLabel("page:book_tabs_content"),
    ),
  component: BookContentPage,
});
