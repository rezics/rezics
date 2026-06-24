import { getI18nRuntime } from "@rezics/i18n/runtime";
import { postQueries } from "@rezics/api/post/post";
import { realmDetailQuery } from "@rezics/api/realm/realm";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  createMinimalEditConsoleConfig,
  EditConsoleLayout,
  routeQueryOrNotFound,
} from "@/core";
import { realmContextPostEditHref, realmContextPostHref } from "@/realm";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const PostEditPage = lazyRouteComponent(
  () => import("@/post/pages/PostEditPage"),
  "PostEditPage",
);

export const Route = createFileRoute(
  "/_editor/realm/$realmId/post/$postUnitId/edit",
)({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const readQuery = {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
    await Promise.all([
      routeQueryOrNotFound(
        context.qc,
        realmDetailQuery(params.realmId, readQuery),
      ),
      routeQueryOrNotFound(
        context.qc,
        postQueries.detail(params.postUnitId, readQuery),
      ),
    ]);
  },
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
