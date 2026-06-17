import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  type RealmStreamSort,
  RealmDetailLayout,
  RealmStreamTab,
} from "@/realm";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import {
  realmDetailHref,
  realmDetailLocationFromSlugParams,
} from "@/realm/models/realmDetailRoutes";

type RealmStreamRouteSearch = {
  sort?: RealmStreamSort;
  tags?: string;
  policyTags?: string;
};

function isRealmStreamSort(value: unknown): value is RealmStreamSort {
  return (
    value === "best" ||
    value === "hot" ||
    value === "new" ||
    value === "top" ||
    value === "rising"
  );
}

function RealmSlugStreamRoute() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { realm } = Route.useLoaderData();
  const routeLocation = realmDetailLocationFromSlugParams(params);
  const tagIds = search.tags?.split(",").filter(Boolean) ?? [];
  const policyTagIds = search.policyTags?.split(",").filter(Boolean) ?? [];
  return (
    <RealmDetailLayout realmId={realm.unitId} routeLocation={routeLocation}>
      <RealmStreamTab
        streamSort={search.sort ?? "best"}
        streamTagIds={tagIds}
        streamPolicyTagIds={policyTagIds}
        onStreamSortChange={(sort) =>
          navigate({ search: (prev) => ({ ...prev, sort }) })
        }
        onStreamTagIdsChange={(next) =>
          navigate({
            search: (prev) => ({
              ...prev,
              tags: next.tagIds.length ? next.tagIds.join(",") : undefined,
              policyTags: next.policyTagIds.length
                ? next.policyTagIds.join(",")
                : undefined,
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
  validateSearch: (
    search: Record<string, unknown>,
  ): RealmStreamRouteSearch => ({
    sort: isRealmStreamSort(search.sort) ? search.sort : "best",
    tags: typeof search.tags === "string" ? search.tags : undefined,
    policyTags:
      typeof search.policyTags === "string" ? search.policyTags : undefined,
  }),
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  component: RealmSlugStreamRoute,
});
