import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { type RealmFeedSort, RealmDetailLayout, RealmFeedTab } from "@/realm";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import {
  realmDetailHref,
  realmDetailLocationFromSlugParams,
} from "@/realm/models/realmDetailRoutes";

type RealmFeedRouteSearch = {
  sort?: RealmFeedSort;
  tags?: string;
};

function isRealmFeedSort(value: unknown): value is RealmFeedSort {
  return (
    value === "best" ||
    value === "hot" ||
    value === "new" ||
    value === "top" ||
    value === "rising"
  );
}

function RealmSlugFeedRoute() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { realm } = Route.useLoaderData();
  const routeLocation = realmDetailLocationFromSlugParams(params);
  const tagIds = search.tags?.split(",").filter(Boolean) ?? [];
  return (
    <RealmDetailLayout realmId={realm.unitId} routeLocation={routeLocation}>
      <RealmFeedTab
        feedSort={search.sort ?? "best"}
        feedTagIds={tagIds}
        onFeedSortChange={(sort) =>
          navigate({ search: (prev) => ({ ...prev, sort }) })
        }
        onFeedTagIdsChange={(nextTagIds) =>
          navigate({
            search: (prev) => ({
              ...prev,
              tags: nextTagIds.length ? nextTagIds.join(",") : undefined,
            }),
          })
        }
        onOpenTagsTab={() =>
          navigate({ to: realmDetailHref(routeLocation, "tags") })
        }
      />
    </RealmDetailLayout>
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/")({
  validateSearch: (search: Record<string, unknown>): RealmFeedRouteSearch => ({
    sort: isRealmFeedSort(search.sort) ? search.sort : "best",
    tags: typeof search.tags === "string" ? search.tags : undefined,
  }),
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  component: RealmSlugFeedRoute,
});
