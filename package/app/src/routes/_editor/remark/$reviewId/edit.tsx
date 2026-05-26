import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { common_back, common_edit } from "@rezics/i18n/messages";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";

const RemarkEditPage = lazyRouteComponent(
  () => import("@/remark/pages/RemarkEditPage"),
  "RemarkEditPage",
);

export const Route = createFileRoute("/_editor/remark/$reviewId/edit")({
  component: () => {
    const { reviewId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: common_back(),
          returnHref: `/remark/${reviewId}`,
          editorLabel: common_edit(),
          editorHref: `/remark/${reviewId}/edit`,
        })}
      >
        <RemarkEditPage reviewId={reviewId} />
      </EditConsoleLayout>
    );
  },
});
