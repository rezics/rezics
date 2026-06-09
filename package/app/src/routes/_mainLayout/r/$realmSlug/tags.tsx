import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  realmFeedSearchForSingleTag,
  RealmDetailLayout,
  useRealmDetail,
} from "@/realm";
import { RealmTagBrowser } from "@/realm/components/RealmTagBrowser";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import {
  realmDetailHref,
  realmDetailLocationFromSlugParams,
} from "@/realm/models/realmDetailRoutes";

function RealmSlugTagsRoute() {
  const params = Route.useParams();
  const { realm } = Route.useLoaderData();
  const routeLocation = realmDetailLocationFromSlugParams(params);
  return (
    <RealmDetailLayout realmId={realm.unitId} routeLocation={routeLocation}>
      <RealmSlugTagsTab />
    </RealmDetailLayout>
  );
}

function RealmSlugTagsTab() {
  const { routeLocation, realmId, realm, tagTree } = useRealmDetail();
  const navigate = Route.useNavigate();
  return (
    <RealmTagBrowser
      realmId={realmId}
      tagTree={tagTree}
      tagView={realm.extra?.tagView ?? null}
      onTagSelect={(tagId) =>
        navigate({
          to: realmDetailHref(routeLocation),
          search: realmFeedSearchForSingleTag({}, tagId),
        })
      }
    />
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/tags")({
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  component: RealmSlugTagsRoute,
});
