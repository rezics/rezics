import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { common_back, common_edit } from "@rezics/i18n/messages";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";

const PostEditPage = lazyRouteComponent(
  () => import("@/post/pages/PostEditPage"),
  "PostEditPage",
);

export const Route = createFileRoute(
  "/_editor/post/$rootPostUnitId/continue/$unitId/edit",
)({
  component: () => {
    const { rootPostUnitId, unitId } = Route.useParams();
    const returnTo = `/post/${rootPostUnitId}/continue/${unitId}`;
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: common_back(),
          returnHref: returnTo,
          editorLabel: common_edit(),
          editorHref: `${returnTo}/edit`,
        })}
      >
        <PostEditPage postUnitId={unitId} returnTo={returnTo} />
      </EditConsoleLayout>
    );
  },
});
