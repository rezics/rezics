import { getI18nRuntime } from "@rezics/i18n/runtime";
import { postQueries } from "@rezics/contract/api/post/post.queries";
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

export const Route = createFileRoute(
  "/_editor/post/$rootPostUnitId/continue/$unitId/edit",
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
        postQueries.detail(params.rootPostUnitId, readQuery),
      ),
      routeQueryOrNotFound(
        context.qc,
        postQueries.detail(params.unitId, readQuery),
      ),
    ]);
  },
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
