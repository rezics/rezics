import { excerptQueries } from "@rezics/contract/api/excerpt/excerpt.queries";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  createMinimalEditConsoleConfig,
  EditConsoleLayout,
  routeQueryOrNotFound,
} from "@/core";

const ExcerptEditPageContainer = lazyRouteComponent(
  () => import("@/excerpt/pages/ExcerptEditPage"),
  "ExcerptEditPageContainer",
);

export const Route = createFileRoute("/_editor/excerpt/$unitId/edit")({
  loader: async ({ params, context }) => {
    await routeQueryOrNotFound(
      context.qc,
      excerptQueries.detail(params.unitId),
    );
  },
  component: () => {
    const { unitId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: getI18nRuntime().i18n.t("common:back"),
          returnHref: `/excerpt/${unitId}`,
          editorLabel: getI18nRuntime().i18n.t("community:excerpt_form_title"),
          editorHref: `/excerpt/${unitId}/edit`,
        })}
      >
        <ExcerptEditPageContainer />
      </EditConsoleLayout>
    );
  },
});
