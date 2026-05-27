import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReviewByBookPage = lazyRouteComponent(
  () => import("@/review/pages/ReviewByBookPage"),
  "ReviewByBookPage",
);

export const Route = createFileRoute("/_mainLayout/review/book/$bookId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    scope?: "work" | "exact";
  } => ({
    scope:
      search.scope === "work" || search.scope === "exact"
        ? search.scope
        : undefined,
  }),
  component: ReviewByBookPage,
});
