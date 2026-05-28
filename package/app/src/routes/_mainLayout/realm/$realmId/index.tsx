import { createFileRoute } from "@tanstack/react-router";
import { RealmPage, type RealmPageTab } from "@/realm/pages/RealmPage";

type RealmSearch = {
  sort?: "new" | "top" | "hot";
  tags?: string;
  tab?: RealmPageTab;
};

export const Route = createFileRoute("/_mainLayout/realm/$realmId/")({
  validateSearch: (search: Record<string, unknown>): RealmSearch => {
    const sort =
      search.sort === "top" || search.sort === "hot" ? search.sort : "new";
    const tab =
      search.tab === "wiki" ||
      search.tab === "tags" ||
      search.tab === "members" ||
      search.tab === "moderation"
        ? search.tab
        : "feed";
    return {
      sort,
      tags: typeof search.tags === "string" ? search.tags : undefined,
      tab,
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
        tab={search.tab}
        feedSort={search.sort ?? "new"}
        feedTagIds={tagIds}
        onTabChange={(tab) =>
          navigate({ search: (prev) => ({ ...prev, tab }) })
        }
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
