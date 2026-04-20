import GridViewIcon from "@mui/icons-material/GridView";
import ListIcon from "@mui/icons-material/List";
import RateReviewIcon from "@mui/icons-material/RateReview";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { bookKeys } from "@rezics/api/book/book.keys";
import { postKeys } from "@rezics/api/post/post.keys";
import type { ShelfItemDTO, ShelfSortMode, ShelfView } from "@rezics/api/shelf";
import {
  shelfDetailQuery,
  shelfItemsQuery,
  useCleanupOrphansMutation,
  useShelfHydration,
} from "@rezics/api/shelf";
import { tagKeys } from "@rezics/api/tag/tag.keys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useUserProfileStore } from "@/user/states";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import { titleOf } from "./titleOf";

interface ShelfPageProps {
  unitId: string;
}

const titleCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

type DetailKey =
  | ReturnType<typeof bookKeys.detail>
  | ReturnType<typeof postKeys.detail>
  | ReturnType<typeof tagKeys.detail>;

function detailKeyFor(item: ShelfItemDTO): DetailKey | undefined {
  switch (item.kind) {
    case "book":
      return bookKeys.detail(item.itemRef);
    case "review":
    case "quote":
    case "post":
      return postKeys.detail(item.itemRef);
    case "tag":
      return tagKeys.detail(item.itemRef);
    default:
      return undefined;
  }
}

export function ShelfPage({ unitId }: ShelfPageProps) {
  const [viewMode, setViewMode] = useState<ShelfView>("grid");
  const [sortMode, setSortMode] = useState<ShelfSortMode>("manual");

  const detailQuery = useQuery(shelfDetailQuery(unitId));
  const itemsQuery = useQuery(shelfItemsQuery(unitId));

  const shelf = detailQuery.data;
  const items = itemsQuery.data?.items ?? [];
  const title = shelf?.translations?.[0]?.title ?? "Shelf";

  const savedViewMode = (shelf?.extra as any)?.viewMode as
    | ShelfView
    | undefined;
  const effectiveViewMode = savedViewMode ?? viewMode;

  const hydration = useShelfHydration(items);
  const queryClient = useQueryClient();
  const currentUser = useUserProfileStore((s) => s.user);
  const isOwner = !!currentUser && currentUser.unitId === shelf?.userId;
  const cleanupMutation = useCleanupOrphansMutation();

  const sortedItems = useMemo(() => {
    const arr = [...items];
    if (sortMode === "manual") {
      arr.sort((a, b) => (a.position < b.position ? -1 : 1));
    } else if (sortMode === "time") {
      arr.sort((a, b) => {
        const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bT - aT;
      });
    } else if (sortMode === "title") {
      arr.sort((a, b) => {
        const aKey = detailKeyFor(a);
        const bKey = detailKeyFor(b);
        const aCached = aKey ? queryClient.getQueryData(aKey) : undefined;
        const bCached = bKey ? queryClient.getQueryData(bKey) : undefined;
        return titleCollator.compare(titleOf(a, aCached), titleOf(b, bCached));
      });
    }
    return arr;
  }, [items, sortMode, hydration.buckets, queryClient]);

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

        <Stack direction="row" spacing={1} alignItems="center">
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
        ) : sortedItems.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No items in this shelf
          </Typography>
        ) : (
          <Stack spacing={1}>
            {sortedItems
              .filter(
                (item) => !hydration.orphanItemRefs.includes(item.itemRef),
              )
              .map((item) => (
                <ShelfItemRenderer
                  key={item.itemRef}
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
