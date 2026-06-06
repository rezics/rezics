import { isPublicRealmShelfSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";

/**
 * `/r/:realmSlug/shelf/:slug` is reserved for realm-owned shelves. In v1
 * realm-owned shelves do not exist yet, so the resolver always 404s.
 */
export const Route = createFileRoute("/_mainLayout/r/$realmSlug/shelf/$slug")({
  loader: ({ params }) => {
    if (!isPublicRealmShelfSlugRouteParams(params)) throw notFound();
    throw notFound();
  },
});
