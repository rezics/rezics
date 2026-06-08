import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { createMinimalEditConsoleConfig, EditConsoleLayout } from "@/core";

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
          returnLabel: getI18nRuntime().i18n.t("common:back"),
          returnHref: `/post/${rootPostUnitId}`,
          editorLabel: getI18nRuntime().i18n.t("common:edit"),
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
