import { useCanEdit } from "@rezics/api/hooks";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { ShelfSortMode, ShelfView } from "@rezics/api/shelf";
import {
  shelfDetailQuery,
  shelfItemsQuery,
  useCleanupOrphansMutation,
  useHydratedShelfItems,
} from "@rezics/api/shelf";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Checkbox,
  DropdownMenuItem,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Pencil as EditIcon,
  LayoutList as ViewAgendaIcon,
  List as ViewListIcon,
  LayoutGrid as ViewQuiltIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { useMediaQuery } from "@/shared/utils/use-media-query";
import { useUserProfileStore } from "@/user/states";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import { shelfDetailActions, shelfPolicy } from "../models/shelfPolicy";
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

function lastSingleToggleValue(values: readonly string[]): string | undefined {
  return values.at(-1);
}

function isShelfView(value: string | undefined): value is ShelfView {
  return value === "nested" || value === "flat" || value === "masonry";
}

function isShelfSortMode(value: string | undefined): value is ShelfSortMode {
  return value === "manual" || value === "time" || value === "title";
}

function requireShelfSortMode(value: ShelfSortMode | null): ShelfSortMode {
  if (value === null) {
    throw new Error("Shelf sort mode select emitted null");
  }
  return value;
}

// MOCK: masonry layout uses CSS column-count as a placeholder until the real
// masonry primitive lands. The column breaks are browser-driven and not
// height-balanced; the emitted stream and the enum value are real.
const MASONRY_COLUMN_CLASS =
  "columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4 [&>*]:block";

const SORT_OPTIONS: { value: ShelfSortMode; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "time", label: "Time" },
  { value: "title", label: "Title" },
];

export function ShelfPage({ unitId }: ShelfPageProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [viewModeOverride, setViewModeOverride] = useState<{
    unitId: string;
    value: ShelfView | undefined;
  }>({ unitId, value: undefined });
  const [sortMode, setSortMode] = useState<ShelfSortMode>("manual");
  const [sortPrimeOnly, setSortPrimeOnly] = useState<boolean>(true);
  const isCompactLayout = useMediaQuery("(max-width: 639px)");

  const detailQuery = useQuery(shelfDetailQuery(unitId));
  const itemsQuery = useQuery(shelfItemsQuery(unitId));

  const shelf = detailQuery.data;
  const items = itemsQuery.data?.items ?? [];
  const translation = shelf ? getTranslation(shelf.translations) : undefined;
  const title = translation?.title ?? "Shelf";
  const description = translation?.description ?? "";

  const savedViewMode = normalizePersistedViewMode(
    (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
  );
  const selectedViewMode =
    viewModeOverride.unitId === unitId ? viewModeOverride.value : undefined;
  const effectiveViewMode = selectedViewMode ?? savedViewMode ?? "nested";

  const hydration = useHydratedShelfItems(items);
  const currentUser = useUserProfileStore((s) => s.user);
  const isOwner = !!currentUser && currentUser.userId === shelf?.userId;
  const canEditShelf = useCanEdit({ resource: "shelf", ownerUnit: shelf });
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

  const reactionPost = useMemo<ReactionBarPost | null>(
    () => (shelf?.unitId ? { unitId: shelf.unitId } : null),
    [shelf?.unitId],
  );

  const showSortScopeToggle =
    (effectiveViewMode === "flat" || effectiveViewMode === "masonry") &&
    sortMode !== "manual";
  const nestedViewLabel = t("shelf.view_modes.nested");
  const flatViewLabel = t("shelf.view_modes.flat");
  const masonryViewLabel = t("shelf.view_modes.masonry");
  const streamKeyPrefix = `${effectiveViewMode}:${sortMode}:${
    sortPrimeOnly ? "prime" : "all"
  }`;
  const selectedSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Manual";

  const handleEditShelf = () => {
    if (!shelf?.unitId) return;
    navigate({
      to: "/shelf/$shelfId/edit",
      params: { shelfId: shelf.unitId },
    });
  };

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
        <div className="flex flex-col gap-5 border-b border-border-whisper pb-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-[1.3]">{title}</h1>
            {description && (
              <p className="mt-2 max-w-2xl text-base text-text-secondary">
                {description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
              <span>{shelf?.itemCount ?? 0} items</span>
              {shelf?.user?.name && <span>by {shelf.user.name}</span>}
            </div>
          </div>

          {(reactionPost || (canEditShelf && shelf?.unitId)) && (
            <div className="flex flex-row items-center gap-2 self-start md:flex-col md:items-end">
              {canEditShelf && shelf?.unitId && !isCompactLayout && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-text-secondary hover:text-text-primary"
                  onClick={handleEditShelf}
                >
                  <EditIcon className="h-4 w-4" />
                  Edit shelf
                </Button>
              )}
              {reactionPost && (
                <ReactionBar
                  post={reactionPost}
                  policy={shelfPolicy}
                  actions={shelfDetailActions}
                  className="flex-nowrap md:justify-end"
                  overflowContent={
                    isCompactLayout && canEditShelf && shelf?.unitId ? (
                      <DropdownMenuItem
                        onClick={handleEditShelf}
                        className="gap-2"
                      >
                        <EditIcon className="h-4 w-4" />
                        <span>Edit shelf</span>
                      </DropdownMenuItem>
                    ) : null
                  }
                />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-sm text-text-secondary">Sort</span>
            <div className="sm:hidden">
              <Select<ShelfSortMode>
                value={sortMode}
                onValueChange={(value) => {
                  setSortMode(requireShelfSortMode(value));
                }}
              >
                <SelectTrigger size="sm" className="min-w-[118px]">
                  <SelectValue>{selectedSortLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ToggleGroup
              value={[sortMode]}
              onValueChange={(values) => {
                const value = lastSingleToggleValue(values);
                if (!isShelfSortMode(value)) return;
                setSortMode(value);
              }}
              size="sm"
              className="hidden sm:flex"
            >
              {SORT_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {showSortScopeToggle && (
              <Label className="flex min-w-0 items-center gap-2 text-sm">
                <Checkbox
                  checked={sortPrimeOnly}
                  onCheckedChange={(checked) =>
                    setSortPrimeOnly(checked === true)
                  }
                />
                <span className="whitespace-nowrap">Sort prime only</span>
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

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-text-secondary">View</span>
            <TooltipProvider>
              <ToggleGroup
                value={[effectiveViewMode]}
                onValueChange={(values) => {
                  const value = lastSingleToggleValue(values);
                  if (!isShelfView(value)) return;
                  setViewModeOverride({ unitId, value });
                }}
                size="sm"
              >
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="nested"
                        aria-label={nestedViewLabel}
                        {...props}
                      >
                        <ViewAgendaIcon className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">{nestedViewLabel}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="flat"
                        aria-label={flatViewLabel}
                        {...props}
                      >
                        <ViewListIcon className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">{flatViewLabel}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="masonry"
                        aria-label={masonryViewLabel}
                        {...props}
                      >
                        <ViewQuiltIcon className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">{masonryViewLabel}</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </TooltipProvider>
          </div>
        </div>

        {itemsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : itemsQuery.isError ? (
          <p className="py-8 text-center text-error">
            Failed to load shelf items
          </p>
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
                    ? `${streamKeyPrefix}:p:${entry.enriched.item.itemRef}`
                    : `${streamKeyPrefix}:r:${entry.parentItemRef}:${entry.review.unitId}`
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
                    ? `${streamKeyPrefix}:p:${entry.enriched.item.itemRef}`
                    : `${streamKeyPrefix}:r:${entry.parentItemRef}:${entry.review.unitId}`
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
