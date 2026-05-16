import { slugApi } from "@rezics/api/slug";
import { isPublicUserShelfSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

/**
 * `/u/:userSlug/shelf/:slug` resolves to a SHELF Unit under the user's
 * owner scope. Returns 404 for any non-system-shelf slug in v1.
 */
export const Route = createFileRoute("/_mainLayout/u/$userSlug/shelf/$slug")({
  loader: async ({ params }) => {
    if (!isPublicUserShelfSlugRouteParams(params)) throw notFound();
    const shelf = await slugApi
      .shelfBySlug(params.userSlug, params.slug)
      .catch(() => null);
    if (!shelf) throw notFound();
    throw redirect({
      to: "/shelf/$shelfId",
      params: { shelfId: shelf.unitId },
    });
  },
});
