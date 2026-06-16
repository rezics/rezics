import { unitDetailQuery } from "@rezics/api/unit/unit";
import { createFileRoute } from "@tanstack/react-router";
import {
  titleOfTranslatedUnit,
  unitTitleMeta,
} from "@/core/routing/documentTitle";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import {
  resolveUnitRoute,
  UnitPageById,
  validatePublicUnitIdParams,
  validatePublicUnitResolverSearch,
} from "@/unit";
import { useUserProfileStore } from "@/user";

export const Route = createFileRoute("/_mainLayout/unit/$unitId/")({
  validateSearch: validatePublicUnitResolverSearch,
  loader: async ({ params, context, deps }) => {
    validatePublicUnitIdParams(params);

    const queryClient = context.qc;
    const readContext = await resolveRouteReadLanguageContext(queryClient);
    const unit = await queryClient
      .ensureQueryData(
        unitDetailQuery(params.unitId, {
          languages: readContext.languages,
          appLocale: readContext.appLocale,
        }),
      )
      .catch(() => null);

    const viewer = useUserProfileStore.getState().user;
    return {
      ...resolveUnitRoute({
        unit,
        viewer: viewer ?? null,
        view: (deps as { view?: "auto" | "unit" }).view ?? "auto",
      }),
      readContext,
    };
  },
  loaderDeps: ({ search }) => search,
  head: ({ loaderData }) =>
    unitTitleMeta(
      "unit",
      loaderData
        ? titleOfTranslatedUnit(loaderData.unit, loaderData.readContext)
        : null,
    ),
  component: () => {
    const { unit } = Route.useLoaderData();
    return <UnitPageById unitId={unit.id} />;
  },
});
