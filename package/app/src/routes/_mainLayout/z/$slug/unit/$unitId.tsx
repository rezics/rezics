import { unitDetailQuery } from "@rezics/api/unit/unit";
import { zoneQueries } from "@rezics/api/zone/zone";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  titleMeta,
  titleOfTranslatedUnit,
  titleOfZone,
} from "@/core/routing/documentTitle";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { UnitPageById } from "@/unit";

export const Route = createFileRoute("/_mainLayout/z/$slug/unit/$unitId")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const readQuery = {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
    const [zone, unit] = await Promise.all([
      context.qc.ensureQueryData(zoneQueries.detail(params.slug, readQuery)),
      context.qc.ensureQueryData(unitDetailQuery(params.unitId, readQuery)),
    ]).catch(() => {
      throw notFound();
    });
    return { zone, unit, readContext };
  },
  head: ({ loaderData }) =>
    titleMeta(
      loaderData
        ? titleOfTranslatedUnit(loaderData.unit, loaderData.readContext)
        : null,
      loaderData ? titleOfZone(loaderData.zone) : null,
    ),
  component: () => {
    const { unitId } = Route.useParams();
    return <UnitPageById unitId={unitId} />;
  },
});
