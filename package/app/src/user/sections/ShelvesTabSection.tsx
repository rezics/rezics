import { getI18nRuntime } from "@rezics/i18n/runtime";

/**
 * ShelvesTabSection — 用户资料页内的书架标签页，支持按名称搜索，
 * 展示用户的所有书架，favorites 保持首位，其余书架支持排序和搜索功能。
 *
 * ┌────────────────────────────────────────────┐
 * │ Shelves Tab (desktop 1024px+)              │
 * │ ┌──────────────────────────────────────────┐
 * │ │ [Search Contents...]                     │
 * │ │ [Search shelf..]  [Sort: Newest ▼]       │
 * │ ├──────────────────────────────────────────┤
 * │ │ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
 * │ │ │[Cover]   │ │[Cover]   │ │ Custom 1 │   │
 * │ │ │Reading   │ │ My Books │ │ 7 items  │   │
 * │ │ │45 items  │ │ 23 items │ └──────────┘   │
 * │ │ └──────────┘ └──────────┘                │
 * │ └──────────────────────────────────────────┘
 * └────────────────────────────────────────────┘
 *
 * ┌──────────────────────────┐
 * │ Shelves (tablet 768px)   │
 * │ ┌────────────────────────┐
 * │ │ [Search Content]       │
 * │ │ [Search..] [Newest ▼]  │
 * │ ├────────────────────────┤
 * │ │ ┌──────────┐ ┌──────────┐
 * │ │ │ Reading  │ │ My Books │
 * │ │ │ 45 items │ │ 23 items │
 * │ │ └──────────┘ └──────────┘
 * │ └────────────────────────┘
 * └──────────────────────────┘
 *
 * ┌──────────────────┐
 * │ Shelves (mobile) │
 * │ ┌────────────────┐
 * │ │ [Search..]     │
 * │ │ All Reading... │
 * │ │ [Search] [▼]   │
 * │ ├────────────────┤
 * │ │ ┌────────────┐ │
 * │ │ │ Reading 45 │ │
 * │ │ └────────────┘ │
 * │ │ ┌────────────┐ │
 * │ │ │ My Books23 │ │
 * │ │ └────────────┘ │
 * │ └────────────────┘
 * └──────────────────┘
 *
 * ┌──────────────────────┐
 * │ Empty (no shelves)   │
 * │ ┌────────────────────┐
 * │ │ No shelves yet     │
 * │ └────────────────────┘
 * └──────────────────────┘
 */

const i18nMessages = {
  shelf_sort_newest: () => getI18nRuntime().i18n.t("entity:shelf_sort_newest"),
  shelf_sort_oldest: () => getI18nRuntime().i18n.t("entity:shelf_sort_oldest"),
} as const;

import { shelfQueries } from "@rezics/api/shelf/shelf.queries";
import { FAVORITES_SHELF_SLUG, type ShelfDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Card } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { type FC, useState } from "react";
import { Link } from "@/shared/ui/link";
import { FilterBar, type FilterBarConfig } from "@/user/components/FilterBar";
import { useProfileContext } from "@/user/components/ProfileLayout";
import { QueryBoundary } from "@/core";

const SORT_OPTION_LABEL = {
  "createdAt:desc": i18nMessages.shelf_sort_newest,
  "createdAt:asc": i18nMessages.shelf_sort_oldest,
} as const satisfies Record<string, () => string>;

export const ShelvesTabSection: FC = () => {
  const { t } = useTranslation(["common", "entity"]);
  const { user, userId, profileRoute } = useProfileContext();
  const [filters, setFilters] = useState<Record<string, string>>({
    sort: "createdAt:desc",
  });

  const [sortField, sortOrder] = (filters.sort ?? "createdAt:desc").split(":");
  const shelfFilters = {
    sort: { field: sortField, order: sortOrder },
  };

  const shelfQuery = useQuery(shelfQueries.byUser(userId, shelfFilters));

  const filterConfig: FilterBarConfig = {
    showSearch: true,
    searchPlaceholder: t("entity:shelf_search_placeholder"),
    dropdowns: [
      {
        key: "sort",
        label: t("entity:shelf_controls_sort_by"),
        options: Object.entries(SORT_OPTION_LABEL).map(([value, label]) => ({
          value,
          label: label(),
        })),
      },
    ],
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <ShelfContentsSearchEntry profileRoute={profileRoute} />

      <FilterBar
        config={filterConfig}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
      />

      <QueryBoundary
        query={shelfQuery}
        isEmpty={(rawData) => {
          const shelves: ShelfDTO[] =
            (rawData as any)?.shelves ?? rawData ?? [];
          const filtered = applyShelfFilter(shelves, filters.q);
          return filtered.length === 0;
        }}
        emptyTitle={
          filters.q
            ? t("entity:shelf_no_search_matches")
            : t("entity:shelf_empty_yet")
        }
      >
        {(rawData) => {
          const shelves: ShelfDTO[] =
            (rawData as any)?.shelves ?? rawData ?? [];
          const filtered = applyShelfFilter(shelves, filters.q);
          return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((shelf) => (
                <ShelfCard
                  key={shelf.unitId}
                  shelf={shelf}
                  userSlug={user.slug}
                />
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
};

const ShelfContentsSearchEntry: FC<{
  profileRoute:
    | { kind: "id"; userId: string }
    | { kind: "slug"; userSlug: string };
}> = ({ profileRoute }) => {
  const { t } = useTranslation(["entity"]);
  const card = (
    <Card
      surface="plain"
      interactive
      className="flex-row items-center justify-between gap-3 px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Search className="h-4 w-4 shrink-0 text-text-secondary" />
        <span className="min-w-0 truncate text-sm font-medium text-text-primary">
          {t("entity:shelf_contents_search_entry_title")}
        </span>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" />
    </Card>
  );

  return (
    <Link
      to={
        profileRoute.kind === "id"
          ? "/user/$userId/profile/shelf/items"
          : "/u/$userSlug/profile/shelf/items"
      }
      params={
        profileRoute.kind === "id"
          ? { userId: profileRoute.userId }
          : { userSlug: profileRoute.userSlug }
      }
      className="no-underline"
    >
      {card}
    </Link>
  );
};

function orderFavoritesFirst(shelves: ShelfDTO[]): ShelfDTO[] {
  const favorites = shelves.filter(
    (shelf) => shelf.slug === FAVORITES_SHELF_SLUG,
  );
  const ordinary = shelves.filter(
    (shelf) => shelf.slug !== FAVORITES_SHELF_SLUG,
  );
  return [...favorites, ...ordinary];
}

/**
 * Apply client-side text filter + favorites-first ordering.
 * 应用客户端文本过滤并将收藏架置顶。
 */
function applyShelfFilter(shelves: ShelfDTO[], q?: string): ShelfDTO[] {
  let result = shelves;
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter((s) => {
      const title = s.translations?.[0]?.title ?? "";
      return title.toLowerCase().includes(lower);
    });
  }
  return orderFavoritesFirst(result);
}

const ShelfCard: FC<{
  shelf: ShelfDTO;
  userSlug?: string;
}> = ({ shelf, userSlug }) => {
  const { t } = useTranslation(["entity"]);
  const dbTitle = shelf.translations?.[0]?.title ?? t("entity:shelf_untitled");
  const title = dbTitle;
  const itemCount =
    shelf.itemCount ?? (shelf as { items?: unknown[] }).items?.length ?? 0;
  const card = (
    <div className="border border-border-whisper rounded-lg p-4 hover:border-border-defined transition-colors h-full flex flex-col">
      {shelf.coverUrl && (
        <img
          src={shelf.coverUrl}
          alt={title}
          className="w-full h-24 object-cover rounded mb-2"
        />
      )}
      <span className="text-sm font-medium line-clamp-2 text-text-primary">
        {title}
      </span>
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-xs text-text-secondary">
          {t("entity:shelf_items_count", { count: itemCount })}
        </span>
      </div>
    </div>
  );

  if (shelf.slug === FAVORITES_SHELF_SLUG && userSlug) {
    return (
      <Link
        to="/u/$userSlug/shelf/$slug"
        params={{ userSlug, slug: FAVORITES_SHELF_SLUG }}
        className="no-underline"
      >
        {card}
      </Link>
    );
  }

  return (
    <Link
      to="/shelf/$shelfId"
      params={{ shelfId: shelf.unitId }}
      className="no-underline"
    >
      {card}
    </Link>
  );
};
