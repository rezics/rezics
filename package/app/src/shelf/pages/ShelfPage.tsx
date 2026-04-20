import ViewAgendaIcon from "@mui/icons-material/ViewAgenda";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewQuiltIcon from "@mui/icons-material/ViewQuilt";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { ShelfSortMode, ShelfView } from "@rezics/api/shelf";
import {
  shelfDetailQuery,
  shelfItemsQuery,
  useCleanupOrphansMutation,
  useHydratedShelfItems,
} from "@rezics/api/shelf";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useUserProfileStore } from "@/user/states";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import { deriveShelfStream } from "../models/shelfStream";

interface ShelfPageProps {
  unitId: string;
}

const LEGACY_VIEW_MODE_MAP: Record<string, ShelfView> = {
  review: "nested",
  list: "flat",
  grid: "masonry",
  nested: "nested",
  flat: "flat",
  masonry: "masonry",
};

function normalizePersistedViewMode(raw: unknown): ShelfView | undefined {
  if (typeof raw !== "string") return undefined;
  return LEGACY_VIEW_MODE_MAP[raw];
}

// MOCK: masonry layout uses CSS column-count as a placeholder until the real
// masonry primitive lands. The column breaks are browser-driven and not
// height-balanced; the emitted stream and the enum value are real.
const MASONRY_COLUMNS_SX = {
  xs: 2,
  sm: 3,
  md: 4,
  lg: 5,
} as const;

export function ShelfPage({ unitId }: ShelfPageProps) {
  const [viewMode, setViewMode] = useState<ShelfView>("nested");
  const [sortMode, setSortMode] = useState<ShelfSortMode>("manual");
  const [sortPrimeOnly, setSortPrimeOnly] = useState<boolean>(true);

  const detailQuery = useQuery(shelfDetailQuery(unitId));
  const itemsQuery = useQuery(shelfItemsQuery(unitId));

  const shelf = detailQuery.data;
  const items = itemsQuery.data?.items ?? [];
  const title = shelf?.translations?.[0]?.title ?? "Shelf";

  const savedViewMode = normalizePersistedViewMode(
    (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
  );
  const effectiveViewMode = savedViewMode ?? viewMode;

  const hydration = useHydratedShelfItems(items);
  const currentUser = useUserProfileStore((s) => s.user);
  const isOwner = !!currentUser && currentUser.unitId === shelf?.userId;
  const cleanupMutation = useCleanupOrphansMutation();

  const orphanRefs = useMemo(
    () => new Set(hydration.orphanItemRefs),
    [hydration.orphanItemRefs],
  );

  const stream = useMemo(
    () =>
      deriveShelfStream(
        hydration.enriched,
        effectiveViewMode,
        sortMode,
        sortPrimeOnly,
      ),
    [hydration.enriched, effectiveViewMode, sortMode, sortPrimeOnly],
  );

  const visibleStream = useMemo(
    () =>
      stream.filter((e) =>
        e.kind === "prime"
          ? !orphanRefs.has(e.enriched.item.itemRef)
          : !orphanRefs.has(e.parentItemRef),
      ),
    [stream, orphanRefs],
  );

  const showSortScopeToggle =
    (effectiveViewMode === "flat" || effectiveViewMode === "masonry") &&
    sortMode !== "manual";

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
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
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
              <ToggleButton value="nested">
                <ViewAgendaIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="flat">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="masonry">
                <ViewQuiltIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="text.secondary">
            Sort
          </Typography>
          <ToggleButtonGroup
            value={sortMode}
            exclusive
            size="small"
            onChange={(_, v) => v && setSortMode(v as ShelfSortMode)}
          >
            <ToggleButton value="manual">Manual</ToggleButton>
            <ToggleButton value="time">Time</ToggleButton>
            <ToggleButton value="title">Title</ToggleButton>
          </ToggleButtonGroup>
          {showSortScopeToggle && (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={sortPrimeOnly}
                  onChange={(_, checked) => setSortPrimeOnly(checked)}
                />
              }
              label="Sort prime only"
            />
          )}
          {hydration.orphanItemRefs.length > 0 && (
            <>
              <Typography variant="caption" color="warning.main">
                {hydration.orphanItemRefs.length} orphan
                {hydration.orphanItemRefs.length === 1 ? "" : "s"}
              </Typography>
              {isOwner && (
                <Button
                  size="small"
                  variant="text"
                  disabled={cleanupMutation.isPending}
                  onClick={() =>
                    cleanupMutation.mutate({
                      shelfUnitId: unitId,
                      input: { orphanItemRefs: hydration.orphanItemRefs },
                    })
                  }
                >
                  Clean up
                </Button>
              )}
            </>
          )}
        </Stack>

        {itemsQuery.isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress size={20} />
          </Box>
        ) : visibleStream.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No items in this shelf
          </Typography>
        ) : effectiveViewMode === "masonry" ? (
          <Box
            sx={{
              columnCount: MASONRY_COLUMNS_SX,
              columnGap: 2,
              "& > *": {
                breakInside: "avoid",
                mb: 2,
                display: "block",
              },
            }}
          >
            {visibleStream.map((entry) => (
              <ShelfItemRenderer
                key={
                  entry.kind === "prime"
                    ? `p:${entry.enriched.item.itemRef}`
                    : `r:${entry.parentItemRef}:${entry.review.unitId}`
                }
                entry={entry}
                viewMode={effectiveViewMode}
              />
            ))}
          </Box>
        ) : (
          <Stack spacing={1}>
            {visibleStream.map((entry) => (
              <ShelfItemRenderer
                key={
                  entry.kind === "prime"
                    ? `p:${entry.enriched.item.itemRef}`
                    : `r:${entry.parentItemRef}:${entry.review.unitId}`
                }
                entry={entry}
                viewMode={effectiveViewMode}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
