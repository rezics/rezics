import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import GridViewIcon from "@mui/icons-material/GridView";
import ListIcon from "@mui/icons-material/List";
import RateReviewIcon from "@mui/icons-material/RateReview";
import { useQuery } from "@tanstack/react-query";
import { shelfDetailQuery, shelfItemsQuery } from "@rezics/api/shelf";
import type { ShelfItemsQuery, ShelfView } from "@rezics/api/shelf";
import { ShelfItemCard } from "../components/ShelfItemCard";

interface ShelfPageProps {
  unitId: string;
}

export function ShelfPage({ unitId }: ShelfPageProps) {
  const [viewMode, setViewMode] = useState<ShelfView>("grid");
  const [filter, setFilter] = useState<ShelfItemsQuery["filter"]>("all");
  const [keywordFilter, setKeywordFilter] = useState<string | undefined>();

  const detailQuery = useQuery(shelfDetailQuery(unitId));
  const itemsQuery = useQuery(
    shelfItemsQuery(unitId, {
      filter,
      keyword: keywordFilter,
      sort: viewMode === "grid" ? "newest" : "manual",
    }),
  );

  const shelf = detailQuery.data;
  const items = itemsQuery.data?.items ?? [];
  const title = shelf?.translations?.[0]?.title ?? "Shelf";

  // Derive viewMode from shelf.extra if set
  const savedViewMode = (shelf?.extra as any)?.viewMode as ShelfView | undefined;
  const effectiveViewMode = savedViewMode ?? viewMode;

  // Collect all unique keywords from items
  const allKeywords = [...new Set(items.flatMap((item) => item.keywords))];

  if (detailQuery.isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">{title}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {shelf?.itemCount ?? 0} items
            </Typography>
            <ToggleButtonGroup
              value={effectiveViewMode}
              exclusive
              size="small"
              onChange={(_, v) => v && setViewMode(v)}
            >
              <ToggleButton value="grid">
                <GridViewIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list">
                <ListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="review">
                <RateReviewIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        {/* Filters */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {(["all", "created", "collected"] as const).map((f) => (
            <Chip
              key={f}
              label={f.charAt(0).toUpperCase() + f.slice(1)}
              size="small"
              variant={filter === f ? "filled" : "outlined"}
              onClick={() => setFilter(f)}
            />
          ))}
          {allKeywords.length > 0 && (
            <>
              <Box sx={{ width: "1px", bgcolor: "divider", mx: 0.5 }} />
              {allKeywords.map((kw) => (
                <Chip
                  key={kw}
                  label={kw}
                  size="small"
                  variant={keywordFilter === kw ? "filled" : "outlined"}
                  onClick={() =>
                    setKeywordFilter(keywordFilter === kw ? undefined : kw)
                  }
                />
              ))}
            </>
          )}
        </Stack>

        {/* Item list */}
        {itemsQuery.isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={20} />
          </Box>
        ) : items.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No items in this shelf
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((item) => (
              <ShelfItemCard
                key={item.itemUnitId}
                item={item}
                viewMode={effectiveViewMode}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
