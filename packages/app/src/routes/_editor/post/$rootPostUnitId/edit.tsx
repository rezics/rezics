import { getI18nRuntime } from "@rezics/i18n/runtime";
import { postQueries } from "@rezics/contract/api/post/post";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  createMinimalEditConsoleConfig,
  EditConsoleLayout,
  routeQueryOrNotFound,
} from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const PostEditPage = lazyRouteComponent(
  () => import("@/post/pages/PostEditPage"),
  "PostEditPage",
);

export const Route = createFileRoute("/_editor/post/$rootPostUnitId/edit")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      postQueries.detail(params.rootPostUnitId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
  },
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
