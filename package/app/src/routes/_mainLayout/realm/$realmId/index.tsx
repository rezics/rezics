import { createFileRoute } from "@tanstack/react-router";
import { RealmPage } from "@/realm/pages/RealmPage";

type RealmSearch = {
  sort?: "new" | "top" | "hot";
  tags?: string;
};

export const Route = createFileRoute("/_mainLayout/realm/$realmId/")({
  validateSearch: (search: Record<string, unknown>): RealmSearch => {
    const sort =
      search.sort === "top" || search.sort === "hot" ? search.sort : "new";
    return {
      sort,
      tags: typeof search.tags === "string" ? search.tags : undefined,
    };
  },
  component: () => {
    const { realmId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const tagIds = search.tags?.split(",").filter(Boolean) ?? [];

    return (
      <RealmPage
        realmId={realmId}
        feedSort={search.sort ?? "new"}
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
      />
    );
  },
});
