import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RemarkEditPage = lazyRouteComponent(
  () => import("@/remark/pages/RemarkEditPage"),
  "RemarkEditPage",
);

export const Route = createFileRoute("/_mainLayout/remark/$reviewId/edit")({
  component: () => {
    const { reviewId } = Route.useParams();
    return <RemarkEditPage reviewId={reviewId} />;
  },
});
