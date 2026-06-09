import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { PostThreadPage } from "@/post";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";

export const Route = createFileRoute(
  "/_mainLayout/r/$realmSlug/post/$postUnitId",
)({
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  component: () => {
    const { realm } = Route.useLoaderData();
    return <PostThreadPage realmUnitId={realm.unitId} />;
  },
});
