import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfRealm,
} from "@/core/routing/documentTitle";
import {
  normalizeRealmCreateMode,
  type RealmCreateMode,
  RealmCreatePage,
} from "@/realm";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import {
  realmDetailHref,
  realmDetailLocationFromSlugParams,
} from "@/realm/models/realmDetailRoutes";

type RealmCreateSearch = {
  mode?: RealmCreateMode;
};

function RealmSlugCreateRoute() {
  const params = Route.useParams();
  const { realm } = Route.useLoaderData();
  const { mode } = Route.useSearch();
  const navigate = Route.useNavigate();
  const routeLocation = realmDetailLocationFromSlugParams(params);

  return (
    <RealmCreatePage
      realmId={realm.unitId}
      mode={mode}
      detailHref={realmDetailHref(routeLocation)}
      onModeChange={(nextMode) =>
        navigate({
          search: (prev) => ({ ...prev, mode: nextMode }),
        })
      }
    />
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/create")({
  validateSearch: (search: Record<string, unknown>): RealmCreateSearch => ({
    mode: normalizeRealmCreateMode(search.mode),
  }),
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  head: async ({ loaderData }) =>
    titleMeta(
      loaderData ? titleOfRealm(loaderData.realm) : null,
      await resolveTitleLabel("zone:create_post"),
    ),
  component: RealmSlugCreateRoute,
});
