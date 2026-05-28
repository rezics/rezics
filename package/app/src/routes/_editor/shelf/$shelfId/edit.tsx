import { createFileRoute } from "@tanstack/react-router";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";
import { ShelfEditPage } from "@/shelf/pages/ShelfEditPage";

import { getI18nRuntime } from "@rezics/i18n/runtime";
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
