import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReviewSearchPage = lazyRouteComponent(
  () => import("@/review/pages/ReviewSearchPage"),
  "ReviewSearchPage",
);

export const Route = createFileRoute("/_mainLayout/review/search")({
  component: ReviewSearchPage,
});
