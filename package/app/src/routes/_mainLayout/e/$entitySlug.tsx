import { isPublicEntitySlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";

/**
 * `/e/:entitySlug` is reserved for the ENTITY slug namespace. In v1 ENTITY
 * slug writes are disabled (`ENTITY_SLUG_WRITES_ENABLED=false`), so the
 * resolver always 404s — the route is present so URLs can be type-checked
 * once `entity-slug-activation` enables the namespace.
 */
export const Route = createFileRoute("/_mainLayout/e/$entitySlug")({
  loader: ({ params }) => {
    if (!isPublicEntitySlugRouteParams(params)) throw notFound();
    throw notFound();
  },
});
