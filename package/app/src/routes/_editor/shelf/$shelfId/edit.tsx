import { createFileRoute } from "@tanstack/react-router";
import { shelf_back_to_shelf, shelf_edit_title } from "@rezics/i18n/messages";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";
import { ShelfEditPage } from "@/shelf/pages/ShelfEditPage";

export const Route = createFileRoute("/_editor/shelf/$shelfId/edit")({
  component: () => {
    const { shelfId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: shelf_back_to_shelf(),
          returnHref: `/shelf/${shelfId}`,
          editorLabel: shelf_edit_title(),
          editorHref: `/shelf/${shelfId}/edit`,
        })}
      >
        <ShelfEditPage shelfId={shelfId} />
      </EditConsoleLayout>
    );
  },
});
