import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { common_back, excerpt_form_title } from "@rezics/i18n/messages";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";

const ExcerptEditPageContainer = lazyRouteComponent(
  () => import("@/excerpt/pages/ExcerptEditPage"),
  "ExcerptEditPageContainer",
);

export const Route = createFileRoute("/_editor/excerpt/$unitId/edit")({
  component: () => {
    const { unitId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: common_back(),
          returnHref: `/excerpt/${unitId}`,
          editorLabel: excerpt_form_title(),
          editorHref: `/excerpt/${unitId}/edit`,
        })}
      >
        <ExcerptEditPageContainer />
      </EditConsoleLayout>
    );
  },
});
