import { unitDetailQuery } from "@rezics/api/unit/unit";
import { createFileRoute } from "@tanstack/react-router";
import { UnitPageById } from "@/unit/pages/UnitPage";
import {
  resolveUnitRoute,
  validatePublicUnitIdParams,
  validatePublicUnitResolverSearch,
} from "@/unit/unitResolver";
import { useUserProfileStore } from "@/user/states";

export const Route = createFileRoute("/_mainLayout/unit/$unitId/")({
  validateSearch: validatePublicUnitResolverSearch,
  loader: async ({ params, context, deps }) => {
    validatePublicUnitIdParams(params);

    const queryClient = context.qc;
    const unit = await queryClient
      .ensureQueryData(unitDetailQuery(params.unitId))
      .catch(() => null);

    const viewer = useUserProfileStore.getState().user;
    return resolveUnitRoute({
      unit,
      viewer: viewer ?? null,
      view: (deps as { view?: "auto" | "unit" }).view ?? "auto",
    });
  },
  loaderDeps: ({ search }) => search,
  component: () => {
    const { unit } = Route.useLoaderData();
    return <UnitPageById unitId={unit.id} />;
  },
});
