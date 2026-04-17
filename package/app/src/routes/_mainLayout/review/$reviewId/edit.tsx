import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReviewEditPageContainer = lazyRouteComponent(
  () => import("@/review/pages/ReviewEditPage"),
  "ReviewEditPageContainer",
);

export const Route = createFileRoute("/_mainLayout/review/$reviewId/edit")({
  component: ReviewEditPageContainer,
});
