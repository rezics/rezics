import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  shelf_sort_newest: () => getI18nRuntime().i18n.t("entity:shelf_sort_newest"),
  shelf_sort_oldest: () => getI18nRuntime().i18n.t("entity:shelf_sort_oldest"),
} as const;

import { shelfQueries } from "@rezics/api/shelf/shelf.queries";
import {
  type ShelfDTO,
  SYSTEM_SHELF_KIND_KEYS,
  type SystemShelfKindKey,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Card } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { Link } from "@/shared/ui/link";
import { systemShelfKindLabel } from "@/shelf";
import { FilterBar, type FilterBarConfig } from "@/user/components/FilterBar";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";

const SORT_OPTION_LABEL = {
  "createdAt:desc": i18nMessages.shelf_sort_newest,
  "createdAt:asc": i18nMessages.shelf_sort_oldest,
} as const satisfies Record<string, () => string>;

export const ShelvesTabSection: FC = () => {
  const { t } = useTranslation(["common", "entity", "search"]);
  const { user, userId, isCurrentUser } = useProfileContext();
  const [kindKey, setKindKey] = useState("all");
  const [filters, setFilters] = useState<Record<string, string>>({
    sort: "createdAt:desc",
  });

  const [sortField, sortOrder] = (filters.sort ?? "createdAt:desc").split(":");
  const shelfFilters = {
    sort: { field: sortField, order: sortOrder },
  };

  const { data, isLoading } = useQuery(
    shelfQueries.byUser(userId, shelfFilters),
  );

  const shelves: ShelfDTO[] = (data as any)?.shelves ?? data ?? [];

  // Build dynamic kind chips from data
  // 从数据动态构建 kind chips
  const kindChips = useMemo<ChipDefinition[]>(() => {
    const kindSet = new Set<string>();
    for (const s of shelves) {
      if (s.kindKey) kindSet.add(s.kindKey);
    }
    const chips: ChipDefinition[] = [
      { value: "all", label: t("search:category_all") },
    ];
    for (const k of kindSet) {
      const label =
        isCurrentUser && isSystemKindKey(k) ? systemShelfKindLabel(k) : k;
      chips.push({ value: k, label });
    }
    return chips;
  }, [shelves, isCurrentUser, t]);

  const filtered = useMemo(() => {
    let result = shelves;
    if (kindKey !== "all") {
      result = result.filter((s) => s.kindKey === kindKey);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      result = result.filter((s) => {
        const title = s.translations?.[0]?.title ?? "";
        return title.toLowerCase().includes(q);
      });
    }
    return result;
  }, [shelves, kindKey, filters.q]);

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
      <ShelfContentsSearchEntry userId={userId} userSlug={user.slug} />

      <InnerFilterPanel
        chips={kindChips}
        activeValue={kindKey}
        onChipChange={setKindKey}
      >
        <FilterBar
          config={filterConfig}
          values={filters}
          onChange={(key, value) =>
            setFilters((prev) => ({ ...prev, [key]: value }))
          }
        />
      </InnerFilterPanel>

      {isLoading ? (
        <p className="text-sm text-text-secondary py-12 text-center">
          {t("common:loading")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-secondary py-12 text-center">
          {filters.q
            ? t("entity:shelf_no_search_matches")
            : t("entity:shelf_empty_yet")}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((shelf) => (
            <ShelfCard
              key={shelf.unitId}
              shelf={shelf}
              isOwnerView={isCurrentUser}
              userSlug={user.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ShelfContentsSearchEntry: FC<{
  userId: string;
  userSlug?: string;
}> = ({ userId, userSlug }) => {
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

  if (userSlug) {
    return (
      <Link
        to="/u/$userSlug/shelves/search"
        params={{ userSlug }}
        className="no-underline"
      >
        {card}
      </Link>
    );
  }

  return (
    <Link
      to="/user/$userId/shelves/search"
      params={{ userId }}
      className="no-underline"
    >
      {card}
    </Link>
  );
};

function isSystemKindKey(
  kindKey: string | null | undefined,
): kindKey is SystemShelfKindKey {
  return (
    !!kindKey && (SYSTEM_SHELF_KIND_KEYS as readonly string[]).includes(kindKey)
  );
}

const ShelfCard: FC<{
  shelf: ShelfDTO;
  isOwnerView: boolean;
  userSlug?: string;
}> = ({ shelf, isOwnerView, userSlug }) => {
  const { t } = useTranslation(["common", "entity", "search"]);
  const dbTitle = shelf.translations?.[0]?.title ?? t("entity:shelf_untitled");
  const systemKindKey = isSystemKindKey(shelf.kindKey) ? shelf.kindKey : null;
  const isSystemShelf = systemKindKey !== null;
  const title =
    isOwnerView && isSystemShelf
      ? systemShelfKindLabel(systemKindKey)
      : dbTitle;
  const itemCount = (shelf as { items?: unknown[] }).items?.length ?? 0;
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
        {shelf.kindKey && (
          <span className="text-xs text-text-secondary">{shelf.kindKey}</span>
        )}
      </div>
    </div>
  );

  if (isSystemShelf && userSlug) {
    return (
      <Link
        to="/u/$userSlug/shelf/$slug"
        params={{ userSlug, slug: systemKindKey }}
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
