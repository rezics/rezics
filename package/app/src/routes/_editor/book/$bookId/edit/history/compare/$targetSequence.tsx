import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookRevisionComparePage = lazyRouteComponent(
  () => import("@/book-library"),
  "BookRevisionComparePage",
);

type CompareSearch = {
  base?: string;
  mode?: "split" | "unified";
};

export const Route = createFileRoute(
  "/_editor/book/$bookId/edit/history/compare/$targetSequence",
)({
  component: BookRevisionComparePage,
  validateSearch: (raw: Record<string, unknown>): CompareSearch => ({
    base: typeof raw.base === "string" ? raw.base : undefined,
    mode: raw.mode === "split" || raw.mode === "unified" ? raw.mode : undefined,
  }),
});
