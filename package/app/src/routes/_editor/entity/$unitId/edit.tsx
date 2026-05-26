import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { common_back, entity_edit_title } from "@rezics/i18n/messages";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";

const EntityEditPage = lazyRouteComponent(
  () => import("@/entity"),
  "EntityEditPage",
);

export const Route = createFileRoute("/_editor/entity/$unitId/edit")({
  component: () => {
    const { unitId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: common_back(),
          returnHref: `/entity/${unitId}`,
          editorLabel: entity_edit_title(),
          editorHref: `/entity/${unitId}/edit`,
        })}
      >
        <EntityEditPage unitId={unitId} />
      </EditConsoleLayout>
    );
  },
});
