import { unitBySlugQuery } from "@rezics/api/unit/unit";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { UnitPageById } from "@/unit/pages/UnitPage";
import {
  isUuidSegment,
  resolveUnitRoute,
  validatePublicUnitResolverSearch,
  validatePublicUnitSlugParams,
} from "@/unit/unitResolver";
import { useUserProfileStore } from "@/user/states";

export const Route = createFileRoute("/_mainLayout/unit/$unitSlug/")({
  validateSearch: validatePublicUnitResolverSearch,
  loader: async ({ params, context, deps }) => {
    validatePublicUnitSlugParams(params);

    if (isUuidSegment(params.unitSlug)) {
      throw redirect({
        to: "/unit/id/$unitId",
        params: { unitId: params.unitSlug },
        search: deps.view === "unit" ? { view: "unit" } : {},
      });
    }

    const queryClient = context.qc;
    const unit = await queryClient
      .ensureQueryData(unitBySlugQuery(params.unitSlug))
      .catch(() => null);

    const viewer = useUserProfileStore.getState().user;
    return resolveUnitRoute({ unit, viewer: viewer ?? null, view: deps.view });
  },
  loaderDeps: ({ search }) => search,
  component: () => {
    const { unit } = Route.useLoaderData();
    return <UnitPageById unitId={unit.id} />;
  },
});
