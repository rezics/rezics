import { getI18nRuntime } from "@rezics/i18n/runtime";
import { postQueries } from "@rezics/api/post/post";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  createMinimalEditConsoleConfig,
  EditConsoleLayout,
  routeQueryOrNotFound,
} from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const RemarkEditPage = lazyRouteComponent(
  () => import("@/remark/pages/RemarkEditPage"),
  "RemarkEditPage",
);

export const Route = createFileRoute("/_editor/remark/$reviewId/edit")({
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
