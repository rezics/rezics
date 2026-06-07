import { createFileRoute } from "@tanstack/react-router";
import {
  type RealmFeedSort,
  RealmPage,
  type RealmPageTab,
} from "@/realm/pages/RealmPage";

type RealmSearch = {
  sort?: RealmFeedSort;
  tags?: string;
  tab?: RealmPageTab;
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

export const Route = createFileRoute("/_mainLayout/realm/$realmId/")({
  validateSearch: (search: Record<string, unknown>): RealmSearch => {
    const sort = isRealmFeedSort(search.sort) ? search.sort : "best";
    const tab =
      search.tab === "wiki" ||
      search.tab === "tags" ||
      search.tab === "about" ||
      search.tab === "members"
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
        feedSort={search.sort ?? "best"}
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
