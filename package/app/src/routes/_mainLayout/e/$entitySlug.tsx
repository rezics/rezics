import { entityBySlugQueryOptions } from "@rezics/api/entity";
import { isPublicEntitySlugRouteParams } from "@rezics/contract";
import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
} from "@tanstack/react-router";

const EntityDetailPage = lazyRouteComponent(
  () => import("@/entity"),
  "EntityDetailPage",
);

/**
 * `/e/:entitySlug` resolves an ENTITY-scope slug to its unitId via
 * `entityBySlugQueryOptions`, then renders the shared EntityDetailPage with
 * the resolved unitId. Returns 404 for unknown slugs.
 */
export const Route = createFileRoute("/_mainLayout/e/$entitySlug")({
  loader: async ({ params, context }) => {
    if (!isPublicEntitySlugRouteParams(params)) throw notFound();
    const entity = await context.qc
      .ensureQueryData(entityBySlugQueryOptions(params.entitySlug))
      .catch(() => {
        throw notFound();
      });
    return { unitId: entity.unitId };
  },
  component: () => {
    const { unitId } = Route.useLoaderData();
    return <EntityDetailPage unitId={unitId} />;
  },
});
