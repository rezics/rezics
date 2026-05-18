import { shelfQueries } from "@rezics/api/shelf/shelf.queries";
import {
  SYSTEM_SHELF_KIND_KEYS,
  type ShelfDTO,
  type SystemShelfKindKey,
} from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { type FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterBar, type FilterBarConfig } from "@/user/components/FilterBar";
import {
  type ChipDefinition,
  InnerFilterPanel,
} from "@/user/components/InnerFilterPanel";
import { useProfileContext } from "@/user/components/ProfileLayout";

function isSystemKindKey(
  kindKey: string | null | undefined,
): kindKey is SystemShelfKindKey {
  return (
    !!kindKey && (SYSTEM_SHELF_KIND_KEYS as readonly string[]).includes(kindKey)
  );
}

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
];

export const ShelvesTabSection: FC = () => {
  const { user, userId, isCurrentUser } = useProfileContext();
  const { t } = useTranslation();
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
  const kindChips = useMemo<ChipDefinition[]>(() => {
    const kindSet = new Set<string>();
    for (const s of shelves) {
      if (s.kindKey) kindSet.add(s.kindKey);
    }
    const chips: ChipDefinition[] = [{ value: "all", label: "All" }];
    for (const k of kindSet) {
      const label =
        isCurrentUser && isSystemKindKey(k) ? t(`shelf.system.${k}`) : k;
      chips.push({ value: k, label });
    }
    return chips;
  }, [shelves, isCurrentUser, t]);

  // Filter shelves
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
    searchPlaceholder: "Search shelves...",
    dropdowns: [{ key: "sort", label: "Sort", options: SORT_OPTIONS }],
  };

  return (
    <div className="flex flex-col gap-4 py-4">
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
          Loading...
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-secondary py-12 text-center">
          {filters.q ? "No shelves match your search" : "No shelves yet"}
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

const ShelfCard: FC<{
  shelf: ShelfDTO;
  isOwnerView: boolean;
  userSlug?: string;
}> = ({ shelf, isOwnerView, userSlug }) => {
  const { t } = useTranslation();
  const dbTitle = shelf.translations?.[0]?.title ?? "Untitled Shelf";
  const isSystemShelf = isSystemKindKey(shelf.kindKey);
  const title =
    isOwnerView && isSystemShelf ? t(`shelf.system.${shelf.kindKey}`) : dbTitle;
  const itemCount = shelf.items?.length ?? 0;
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
        <span className="text-xs text-text-secondary">{itemCount} items</span>
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
        params={{ userSlug, slug: shelf.kindKey }}
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
