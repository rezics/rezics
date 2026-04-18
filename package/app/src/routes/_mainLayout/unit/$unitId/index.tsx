import { unitDetailQuery } from "@rezics/api/unit/unit";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { buildUnitUrl } from "@/shared/utils/build-url";
import { canAccessUnit } from "@/unit/canAccessUnit";
import { useUserProfileStore } from "@/user/states";

export const Route = createFileRoute("/_mainLayout/unit/$unitId/")({
  loader: async ({ params, context }) => {
    const { unitId } = params;
    const queryClient = (context as any)?.queryClient;
    const unit = queryClient
      ? await queryClient.ensureQueryData(unitDetailQuery(unitId))
      : null;

    if (!unit) throw notFound();

    const viewer = useUserProfileStore.getState().user;
    if (!canAccessUnit(unit, viewer ?? null)) throw notFound();

    const target = buildUnitUrl(unit);
    if (target && target !== `/unit/${unitId}`) {
      throw redirect({ to: target });
    }

    throw redirect({ to: "/unit/$unitId/view", params: { unitId } });
  },
  component: () => null,
});

function notFound(): Error {
  const err = new Error("Not found");
  (err as { status?: number }).status = 404;
  return err;
}
