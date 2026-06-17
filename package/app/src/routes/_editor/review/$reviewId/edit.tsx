import { getI18nRuntime } from "@rezics/i18n/runtime";
import { postQueries } from "@rezics/api/post/post";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  createMinimalEditConsoleConfig,
  EditConsoleLayout,
  routeQueryOrNotFound,
} from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const ReviewEditPageContainer = lazyRouteComponent(
  () => import("@/review/pages/ReviewEditPage"),
  "ReviewEditPageContainer",
);

export const Route = createFileRoute("/_editor/review/$reviewId/edit")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      postQueries.detail(params.reviewId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
  },
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
