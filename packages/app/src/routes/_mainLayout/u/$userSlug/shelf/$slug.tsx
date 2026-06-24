import { slugApi } from "@rezics/contract/api/slug";
import { isPublicUserShelfSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { ShelfPage } from "@/shelf";

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
    return { shelfId: shelf.unitId };
  },
  component: () => {
    const { shelfId } = Route.useLoaderData();
    return <ShelfPage unitId={shelfId} />;
  },
});
