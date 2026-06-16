import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { createMinimalEditConsoleConfig, EditConsoleLayout } from "@/core";

const ShelfEditPage = lazyRouteComponent(
  () => import("@/shelf/pages/ShelfEditPage"),
  "ShelfEditPage",
);

export const Route = createFileRoute("/_editor/shelf/$shelfId/edit")({
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
