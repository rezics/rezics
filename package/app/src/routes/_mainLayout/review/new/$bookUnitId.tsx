import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReviewNewPage = lazyRouteComponent(
  () => import("@/review/page/ReviewNewPage"),
  "ReviewNewPage",
);

function ReviewNewPageContainer() {
  const { bookUnitId } = Route.useParams();
  return <ReviewNewPage bookUnitId={bookUnitId} />;
}

export const Route = createFileRoute("/_mainLayout/review/new/$bookUnitId")({
  component: ReviewNewPageContainer,
});
