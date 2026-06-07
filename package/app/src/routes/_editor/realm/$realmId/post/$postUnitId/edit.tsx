import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { createMinimalEditConsoleConfig } from "@/core/layouts/editConsoleConfig";
import {
  realmContextPostEditHref,
  realmContextPostHref,
} from "@/realm/models/realmPostContext";

const PostEditPage = lazyRouteComponent(
  () => import("@/post/pages/PostEditPage"),
  "PostEditPage",
);

export const Route = createFileRoute(
  "/_editor/realm/$realmId/post/$postUnitId/edit",
)({
  component: () => {
    const { realmId, postUnitId } = Route.useParams();
    const returnTo = realmContextPostHref({ realmId, postUnitId });
    return (
      <EditConsoleLayout
        {...createMinimalEditConsoleConfig({
          returnLabel: getI18nRuntime().i18n.t("common:back"),
          returnHref: returnTo,
          editorLabel: getI18nRuntime().i18n.t("common:edit"),
          editorHref: realmContextPostEditHref({ realmId, postUnitId }),
        })}
      >
        <PostEditPage postUnitId={postUnitId} returnTo={returnTo} />
      </EditConsoleLayout>
    );
  },
});
