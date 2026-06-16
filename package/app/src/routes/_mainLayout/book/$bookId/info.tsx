import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { bookRouteLoaderData } from "./route";

type BookInfoSearch = {
  focus?: "remark";
};

const BookBasicInfoPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookBasicInfoPage",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId/info")({
  validateSearch: (search: Record<string, unknown>): BookInfoSearch => ({
    focus: search.focus === "remark" ? "remark" : undefined,
  }),
  head: ({ matches }) => {
    const data = bookRouteLoaderData(matches);
    return titleMeta(
      data ? titleOfBook(data.book, data.readContext) : null,
      titleLabel("page:book_tabs_info"),
    );
  },
  component: BookBasicInfoPage,
});
