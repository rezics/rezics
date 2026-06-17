import { createFileRoute } from "@tanstack/react-router";
import { type RealmStreamSort, RealmStreamTab } from "@/realm";

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

export const Route = createFileRoute("/_mainLayout/realm/$realmId/_detail/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): RealmStreamRouteSearch => ({
    sort: isRealmStreamSort(search.sort) ? search.sort : "best",
    tags: typeof search.tags === "string" ? search.tags : undefined,
    policyTags:
      typeof search.policyTags === "string" ? search.policyTags : undefined,
  }),
  component: () => {
    const { realmId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const tagIds = search.tags?.split(",").filter(Boolean) ?? [];
    const policyTagIds = search.policyTags?.split(",").filter(Boolean) ?? [];

    return (
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
          navigate({ to: "/realm/$realmId/tags", params: { realmId } })
        }
      />
    );
  },
});
