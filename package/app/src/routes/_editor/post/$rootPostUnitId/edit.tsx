import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { common_back, common_edit } from "@rezics/i18n/messages";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";

const PostEditPage = lazyRouteComponent(
  () => import("@/post/pages/PostEditPage"),
  "PostEditPage",
);

export const Route = createFileRoute("/_editor/post/$rootPostUnitId/edit")({
  component: () => {
    const { rootPostUnitId } = Route.useParams();
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: common_back(),
          returnHref: `/post/${rootPostUnitId}`,
          editorLabel: common_edit(),
          editorHref: `/post/${rootPostUnitId}/edit`,
        })}
      >
        <PostEditPage
          postUnitId={rootPostUnitId}
          returnTo={`/post/${rootPostUnitId}`}
        />
      </EditConsoleLayout>
    );
  },
});
