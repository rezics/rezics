import { Box, Typography } from "@mui/material";
import { shelfQueries } from "@rezics/api/shelf/shelf.queries";
import type { ShelfDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FC } from "react";
import { useProfileContext } from "@/user/component/ProfileShell";
import {
  InnerFilterPanel,
  type ChipDefinition,
} from "@/user/component/InnerFilterPanel";
import { FilterBar, type FilterBarConfig } from "@/user/component/FilterBar";

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
];

export const ShelvesTabSection: FC = () => {
  const { unitId } = useProfileContext();
  const [kindKey, setKindKey] = useState("all");
  const [filters, setFilters] = useState<Record<string, string>>({
    sort: "createdAt:desc",
  });

  const { data, isLoading } = useQuery(shelfQueries.byUser(unitId));

  const shelves: ShelfDTO[] = (data as any)?.shelves ?? data ?? [];

  // Build dynamic kind chips from data
  const kindChips = useMemo<ChipDefinition[]>(() => {
    const kindSet = new Set<string>();
    for (const s of shelves) {
      if (s.kindKey) kindSet.add(s.kindKey);
    }
    const chips: ChipDefinition[] = [{ value: "all", label: "All" }];
    for (const k of kindSet) {
      chips.push({ value: k, label: k });
    }
    return chips;
  }, [shelves]);

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
    dropdowns: [
      { key: "sort", label: "Sort", options: SORT_OPTIONS },
    ],
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
        <Typography variant="body2" color="text.secondary" className="py-8 text-center">
          Loading...
        </Typography>
      ) : filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" className="py-8 text-center">
          {filters.q ? "No shelves match your search" : "No shelves yet"}
        </Typography>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((shelf) => (
            <ShelfCard key={shelf.unitId} shelf={shelf} />
          ))}
        </div>
      )}
    </div>
  );
};

const ShelfCard: FC<{ shelf: ShelfDTO }> = ({ shelf }) => {
  const title =
    shelf.translations?.[0]?.title ?? "Untitled Shelf";
  const itemCount = shelf.items?.length ?? 0;

  return (
    <Link
      to="/shelf/$unitId"
      params={{ unitId: shelf.unitId }}
      className="no-underline"
    >
      <Box className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors h-full flex flex-col">
        {shelf.coverUrl && (
          <img
            src={shelf.coverUrl}
            alt={title}
            className="w-full h-24 object-cover rounded mb-2"
          />
        )}
        <Typography variant="body2" className="font-medium line-clamp-2" color="text.primary">
          {title}
        </Typography>
        <div className="flex items-center justify-between mt-auto pt-2">
          <Typography variant="caption" color="text.secondary">
            {itemCount} items
          </Typography>
          {shelf.kindKey && (
            <Typography variant="caption" color="text.secondary">
              {shelf.kindKey}
            </Typography>
          )}
        </div>
      </Box>
    </Link>
  );
};
