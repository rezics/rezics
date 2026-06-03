import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
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
          returnLabel: getI18nRuntime().i18n.t("common:back"),
          returnHref: `/review/${reviewId}`,
          editorLabel: getI18nRuntime().i18n.t("community:review_edit_title"),
          editorHref: `/review/${reviewId}/edit`,
        })}
      >
        <ReviewEditPageContainer />
      </EditConsoleLayout>
    );
  },
});
