import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
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
          returnLabel: getI18nRuntime().i18n.t("common:back"),
          returnHref: returnTo,
          editorLabel: getI18nRuntime().i18n.t("common:edit"),
          editorHref: `${returnTo}/edit`,
        })}
      >
        <PostEditPage postUnitId={unitId} returnTo={returnTo} />
      </EditConsoleLayout>
    );
  },
});
