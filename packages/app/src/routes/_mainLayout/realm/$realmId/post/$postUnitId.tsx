import { postQueries } from "@rezics/contract/api/post/post.queries";
import { realmDetailQuery } from "@rezics/contract/api/realm/realm.queries";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  titleContext,
  titleOfPost,
  titleOfRealm,
  unitTitleMeta,
} from "@/core/routing/documentTitle";
import { PostThreadPage } from "@/post";
import { isRealmUnitIdParam } from "@/realm/models/realmDetailRoutes";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { realmPresentationContext } from "@/unit";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/post/$postUnitId",
)({
  loader: async ({ params, context }) => {
    if (!isRealmUnitIdParam(params.realmId)) throw notFound();
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const readQuery = {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
    const [realm, post] = await Promise.all([
      context.qc.ensureQueryData(realmDetailQuery(params.realmId, readQuery)),
      context.qc.ensureQueryData(
        postQueries.detail(params.postUnitId, readQuery),
      ),
    ]).catch(() => {
      throw notFound();
    });
    return { realm, post, readContext };
  },
  head: ({ loaderData }) =>
    unitTitleMeta("post", loaderData ? titleOfPost(loaderData.post) : null, [
      titleContext(
        "realm",
        loaderData
          ? titleOfRealm(loaderData.realm, loaderData.readContext)
          : null,
      ),
    ]),
  component: () => {
    const { realm } = Route.useLoaderData();
    return (
      <PostThreadPage
        realmUnitId={realm.unitId}
        presentationContext={realmPresentationContext(realm.unitId)}
      />
    );
  },
});
