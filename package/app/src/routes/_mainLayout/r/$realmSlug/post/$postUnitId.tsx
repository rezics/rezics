import { postQueries } from "@rezics/api/post/post";
import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  titleMeta,
  titleOfPost,
  titleOfRealm,
} from "@/core/routing/documentTitle";
import { PostThreadPage } from "@/post";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";

export const Route = createFileRoute(
  "/_mainLayout/r/$realmSlug/post/$postUnitId",
)({
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    const realmData = await loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
    const post = await context.qc
      .ensureQueryData(
        postQueries.detail(params.postUnitId, {
          languages: realmData.readContext.languages,
          appLocale: realmData.readContext.appLocale,
        }),
      )
      .catch(() => {
        throw notFound();
      });
    return { ...realmData, post };
  },
  head: ({ loaderData }) =>
    titleMeta(
      loaderData ? titleOfPost(loaderData.post) : null,
      loaderData
        ? titleOfRealm(loaderData.realm, loaderData.readContext)
        : null,
    ),
  component: () => {
    const { realm } = Route.useLoaderData();
    return <PostThreadPage realmUnitId={realm.unitId} />;
  },
});
