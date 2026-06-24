import { unitDetailQuery } from "@rezics/contract/api/unit/unit";
import { zoneQueries } from "@rezics/contract/api/zone/zone";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  titleContext,
  titleOfTranslatedUnit,
  titleOfZone,
  unitTitleMeta,
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
    unitTitleMeta(
      "unit",
      loaderData
        ? titleOfTranslatedUnit(loaderData.unit, loaderData.readContext)
        : null,
      [titleContext("zone", loaderData ? titleOfZone(loaderData.zone) : null)],
    ),
  component: () => {
    const { unitId } = Route.useParams();
    return <UnitPageById unitId={unitId} />;
  },
});
