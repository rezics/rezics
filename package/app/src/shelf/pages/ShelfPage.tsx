import type { ShelfSortMode, ShelfView } from "@rezics/api/shelf";
import {
  shelfDetailQuery,
  shelfItemsQuery,
  useCleanupOrphansMutation,
  useHydratedShelfItems,
} from "@rezics/api/shelf";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Checkbox,
  Label,
  ToggleGroup,
  ToggleGroupItem,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid as ViewQuiltIcon,
  LayoutList as ViewAgendaIcon,
  List as ViewListIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useUserProfileStore } from "@/user/states";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import { deriveShelfStream } from "../models/shelfStream";
import { ShelfDiscussionSection } from "../sections/ShelfDiscussionSection";

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
const MASONRY_COLUMN_CLASS =
  "columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4 [&>*]:block";

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
  const isOwner = !!currentUser && currentUser.userId === shelf?.userId;
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

  const reactionTargetIds = useMemo(() => {
    const ids = new Set<string>();
    if (shelf?.unitId) ids.add(shelf.unitId);
    for (const entry of visibleStream) {
      if (entry.kind === "review") {
        if (entry.review.unitId) ids.add(entry.review.unitId);
      } else {
        const primary = entry.enriched.primary as
          | { unitId?: string; id?: string }
          | undefined;
        const id = primary?.unitId ?? primary?.id;
        if (id) ids.add(id);
      }
    }
    return [...ids];
  }, [shelf?.unitId, visibleStream]);
  useReactionHydration(reactionTargetIds);

  const showSortScopeToggle =
    (effectiveViewMode === "flat" || effectiveViewMode === "masonry") &&
    sortMode !== "manual";

  if (detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-row items-center justify-between">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="flex flex-row items-center gap-2">
            <span className="text-sm text-text-secondary">
              {shelf?.itemCount ?? 0} items
            </span>
            <ToggleGroup
              type="single"
              value={effectiveViewMode}
              onValueChange={(v) => v && setViewMode(v as ShelfView)}
              size="sm"
            >
              <ToggleGroupItem value="nested" aria-label="Nested view">
                <ViewAgendaIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="flat" aria-label="Flat view">
                <ViewListIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="masonry" aria-label="Masonry view">
                <ViewQuiltIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">Sort</span>
          <ToggleGroup
            type="single"
            value={sortMode}
            onValueChange={(v) => v && setSortMode(v as ShelfSortMode)}
            size="sm"
          >
            <ToggleGroupItem value="manual">Manual</ToggleGroupItem>
            <ToggleGroupItem value="time">Time</ToggleGroupItem>
            <ToggleGroupItem value="title">Title</ToggleGroupItem>
          </ToggleGroup>
          {showSortScopeToggle && (
            <Label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={sortPrimeOnly}
                onCheckedChange={(checked) =>
                  setSortPrimeOnly(checked === true)
                }
              />
              Sort prime only
            </Label>
          )}
          {hydration.orphanItemRefs.length > 0 && (
            <>
              <span
                className="text-xs"
                style={{
                  color: "var(--colors-semantic-warning-fill, #f59e0b)",
                }}
              >
                {hydration.orphanItemRefs.length} orphan
                {hydration.orphanItemRefs.length === 1 ? "" : "s"}
              </span>
              {isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
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
        </div>

        {itemsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : visibleStream.length === 0 ? (
          <p className="py-8 text-center text-text-secondary">
            No items in this shelf
          </p>
        ) : effectiveViewMode === "masonry" ? (
          <div className={MASONRY_COLUMN_CLASS}>
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
          </div>
        ) : (
          <div className="flex flex-col gap-2">
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
          </div>
        )}

        {shelf?.unitId && <ShelfDiscussionSection shelfUnitId={shelf.unitId} />}
      </div>
    </div>
  );
}
