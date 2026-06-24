import { slugApi } from "@rezics/contract/api/slug";
import { isPublicTagSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/t/$tagSlug")({
  loader: async ({ params }) => {
    if (!isPublicTagSlugRouteParams(params)) throw notFound();
    const resolved = await slugApi
      .resolve({ scope: "tag", slug: params.tagSlug })
      .catch(() => null);
    if (!resolved) throw notFound();
    throw redirect({
      to: "/tag/$unitId",
      params: { unitId: resolved.unitId },
    });
  },
});
