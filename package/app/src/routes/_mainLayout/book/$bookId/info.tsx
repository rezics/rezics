import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookChildRouteLoader } from "./route";

type BookInfoSearch = {
  focus?: "remark";
};

const BookBasicInfoPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookBasicInfoPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/info")({
  loader: bookChildRouteLoader,
  validateSearch: (search: Record<string, unknown>): BookInfoSearch => ({
    focus: search.focus === "remark" ? "remark" : undefined,
  }),
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfBook(loaderData.book, loaderData.readContext),
      await resolveTitleLabel("page:book_tabs_info"),
    ),
  component: BookBasicInfoPage,
});
