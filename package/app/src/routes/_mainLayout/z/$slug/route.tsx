import { zoneQueries } from "@rezics/api/zone/zone";
import type { ZoneDTO } from "@rezics/contract";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import {
  loaderDataByRouteId,
  titleMeta,
  titleOfZone,
} from "@/core/routing/documentTitle";
import {
  type ResolvedReadLanguageContext,
  resolveRouteReadLanguageContext,
} from "@/shared/models/readLanguageContext";

export const Route = createFileRoute("/_mainLayout/z/$slug")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const zone = await context.qc
      .ensureQueryData(
        zoneQueries.detail(params.slug, {
          languages: readContext.languages,
          appLocale: readContext.appLocale,
        }),
      )
      .catch(() => {
        throw notFound();
      });
    return { zone, readContext };
  },
  head: ({ loaderData }) =>
    titleMeta(loaderData ? titleOfZone(loaderData.zone) : null),
  component: Outlet,
});

export type ZoneSlugRouteLoaderData = {
  zone: ZoneDTO;
  readContext: ResolvedReadLanguageContext;
};

export function zoneSlugRouteLoaderData(
  matches: readonly { routeId: string; loaderData?: unknown }[],
) {
  return loaderDataByRouteId<ZoneSlugRouteLoaderData>(
    matches,
    "/_mainLayout/z/$slug",
  );
}
