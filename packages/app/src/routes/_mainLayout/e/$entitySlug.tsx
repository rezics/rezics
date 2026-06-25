import { entityBySlugQueryOptions } from "@rezics/contract/api/entity/entity.queries";
import { isPublicEntitySlugRouteParams } from "@rezics/contract";
import { titleOfEntity, unitTitleMeta } from "@/core/routing/documentTitle";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
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
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const entity = await context.qc
      .ensureQueryData(entityBySlugQueryOptions(params.entitySlug))
      .catch(() => {
        throw notFound();
      });
    return { entity, readContext, unitId: entity.unitId };
  },
  head: ({ loaderData }) =>
    unitTitleMeta(
      "entity",
      loaderData
        ? titleOfEntity(loaderData.entity, loaderData.readContext)
        : null,
    ),
  component: () => {
    const { unitId } = Route.useLoaderData();
    return <EntityDetailPage unitId={unitId} />;
  },
});
