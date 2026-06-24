import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookLibPage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookLibPage",
);

export const Route = createFileRoute("/_mainLayout/book/search")({
  component: BookLibPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { tags?: string; keyword?: string } => {
    return {
      tags: typeof search.tags === "string" ? search.tags : undefined,
      keyword: typeof search.keyword === "string" ? search.keyword : undefined,
    };
  },
});
