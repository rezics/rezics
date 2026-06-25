import { entityDetailQueryOptions } from "@rezics/contract/api/entity/entity.queries";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  createMinimalEditConsoleConfig,
  EditConsoleLayout,
  routeQueryOrNotFound,
} from "@/core";

const EntityEditPage = lazyRouteComponent(
  () => import("@/entity"),
  "EntityEditPage",
);

export const Route = createFileRoute("/_editor/entity/$unitId/edit")({
  loader: async ({ params, context }) => {
    await routeQueryOrNotFound(
      context.qc,
      entityDetailQueryOptions(params.unitId),
    );
  },
  component: () => {
    const { unitId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: getI18nRuntime().i18n.t("common:back"),
          returnHref: `/entity/${unitId}`,
          editorLabel: getI18nRuntime().i18n.t("entity:edit_title"),
          editorHref: `/entity/${unitId}/edit`,
        })}
      >
        <EntityEditPage unitId={unitId} />
      </EditConsoleLayout>
    );
  },
});
