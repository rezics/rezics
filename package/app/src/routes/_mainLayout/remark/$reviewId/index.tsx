import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReviewPage = lazyRouteComponent(
  () => import("@/review/pages/ReviewPage"),
  "ReviewPage",
);

export const Route = createFileRoute("/_mainLayout/remark/$reviewId/")({
  component: ReviewPage,
});
