import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { createMinimalEditConsoleConfig, EditConsoleLayout } from "@/core";

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
          returnLabel: getI18nRuntime().i18n.t("common:back"),
          returnHref: `/remark/${reviewId}`,
          editorLabel: getI18nRuntime().i18n.t("common:edit"),
          editorHref: `/remark/${reviewId}/edit`,
        })}
      >
        <RemarkEditPage reviewId={reviewId} />
      </EditConsoleLayout>
    );
  },
});
