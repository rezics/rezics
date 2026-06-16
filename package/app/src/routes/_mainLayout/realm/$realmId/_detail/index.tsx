import { createFileRoute } from "@tanstack/react-router";
import { type RealmFeedSort, RealmFeedTab } from "@/realm";

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

export const Route = createFileRoute("/_mainLayout/realm/$realmId/_detail/")({
  validateSearch: (search: Record<string, unknown>): RealmFeedRouteSearch => ({
    sort: isRealmFeedSort(search.sort) ? search.sort : "best",
    tags: typeof search.tags === "string" ? search.tags : undefined,
  }),
  component: () => {
    const { realmId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const tagIds = search.tags?.split(",").filter(Boolean) ?? [];

    return (
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
          navigate({ to: "/realm/$realmId/tags", params: { realmId } })
        }
      />
    );
  },
});
