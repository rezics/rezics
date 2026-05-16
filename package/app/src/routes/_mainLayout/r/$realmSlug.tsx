import { slugApi } from "@rezics/api/slug";
import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/r/$realmSlug")({
  loader: async ({ params }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    const resolved = await slugApi
      .resolve({ scope: "realm", slug: params.realmSlug })
      .catch(() => null);
    if (!resolved) throw notFound();
    throw redirect({
      to: "/realm/$realmId",
      params: { realmId: resolved.unitId },
    });
  },
});
