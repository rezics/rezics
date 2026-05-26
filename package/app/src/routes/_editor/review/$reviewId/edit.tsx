import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { common_back, review_edit_title } from "@rezics/i18n/messages";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";

const ReviewEditPageContainer = lazyRouteComponent(
  () => import("@/review/pages/ReviewEditPage"),
  "ReviewEditPageContainer",
);

export const Route = createFileRoute("/_editor/review/$reviewId/edit")({
  component: () => {
    const { reviewId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: common_back(),
          returnHref: `/review/${reviewId}`,
          editorLabel: review_edit_title(),
          editorHref: `/review/${reviewId}/edit`,
        })}
      >
        <ReviewEditPageContainer />
      </EditConsoleLayout>
    );
  },
});
