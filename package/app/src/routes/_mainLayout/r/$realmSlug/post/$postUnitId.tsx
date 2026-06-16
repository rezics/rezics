import { slugApi } from "@rezics/api/slug";
import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { PostThreadPage } from "@/post";

export const Route = createFileRoute(
  "/_mainLayout/r/$realmSlug/post/$postUnitId",
)({
  loader: async ({ params }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    const resolved = await slugApi
      .resolve({ scope: "realm", slug: params.realmSlug })
      .catch(() => null);
    if (!resolved) throw notFound();
    return { realmUnitId: resolved.unitId };
  },
  component: () => {
    const { realmUnitId } = Route.useLoaderData();
    return <PostThreadPage realmUnitId={realmUnitId} />;
  },
});
