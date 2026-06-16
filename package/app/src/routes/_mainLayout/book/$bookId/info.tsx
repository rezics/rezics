import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
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
  head: ({ loaderData }) =>
    unitTitleMeta("book", titleOfBook(loaderData.book, loaderData.readContext)),
  component: BookBasicInfoPage,
});
