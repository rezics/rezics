import { shelfDetailQuery } from "@rezics/contract/api/shelf/shelf";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  createMinimalEditConsoleConfig,
  EditConsoleLayout,
  routeQueryOrNotFound,
} from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const ShelfEditPage = lazyRouteComponent(
  () => import("@/shelf/pages/ShelfEditPage"),
  "ShelfEditPage",
);

export const Route = createFileRoute("/_editor/shelf/$shelfId/edit")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      shelfDetailQuery(params.shelfId, {
        languages: readContext.languages.join(",") || undefined,
        appLocale: readContext.appLocale,
      }),
    );
  },
  component: () => {
    const { shelfId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: getI18nRuntime().i18n.t("entity:shelf_back_to_shelf"),
          returnHref: `/shelf/${shelfId}`,
          editorLabel: getI18nRuntime().i18n.t("entity:shelf_edit_title"),
          editorHref: `/shelf/${shelfId}/edit`,
        })}
      >
        <ShelfEditPage shelfId={shelfId} />
      </EditConsoleLayout>
    );
  },
});
