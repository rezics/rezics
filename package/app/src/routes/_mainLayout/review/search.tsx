import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReviewSearchPage = lazyRouteComponent(
  () => import("@/review/page/ReviewSearchPage"),
  "ReviewSearchPage",
);

export const Route = createFileRoute("/_mainLayout/review/search")({
  component: ReviewSearchPage,
});
