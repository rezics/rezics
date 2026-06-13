import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

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
  component: BookBasicInfoPage,
});
