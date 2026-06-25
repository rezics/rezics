import { entityDetailQueryOptions } from "@rezics/contract/api/entity/entity";
import { isPublicUnitIdRouteParams } from "@rezics/contract";
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
 * `/entity/:unitId` renders the shared EntityDetailPage directly. No slug
 * resolution step. Returns 404 when the unitId is not UUID-shaped, does not
 * exist, or is not ENTITY-typed (the loader's ensureQueryData hits
 * `GET /entity/:unitId`, which 404s on type mismatch).
 */
export const Route = createFileRoute("/_mainLayout/entity/$unitId/")({
  loader: async ({ params, context }) => {
    if (!isPublicUnitIdRouteParams(params)) throw notFound();
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const entity = await context.qc
      .ensureQueryData(entityDetailQueryOptions(params.unitId))
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
