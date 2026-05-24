import { useCanEdit } from "@rezics/api/hooks";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { ShelfSortState, ShelfView } from "@rezics/api/shelf";
import {
  shelfDetailQuery,
  shelfUnitsInfiniteQuery,
  useCleanupOrphansMutation,
  useCollectionStatusHydration,
  useHydratedShelfUnits,
} from "@rezics/api/shelf";
import {
  contentDocMarkdownFallback,
  shelfCoverImageSpec,
} from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import { Button, Checkbox, DropdownMenuItem, Label } from "@rezics/ui/shadcn";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as EditIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { useMediaQuery } from "@/shared/utils/use-media-query";
import { useUserProfileStore } from "@/user/states";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import {
  type ShelfSortChoice,
  ShelfSortViewPicker,
  type ShelfViewChoice,
} from "../components/ShelfSortViewPicker";
import { shelfDetailActions, shelfPolicy } from "../models/shelfPolicy";
import {
  deriveShelfStream,
  type ShelfStreamEntry,
} from "../models/shelfStream";
import { ShelfDiscussionSection } from "../sections/ShelfDiscussionSection";

interface ShelfPageProps {
  unitId: string;
}

function normalizePersistedViewMode(raw: unknown): ShelfView | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw === "nested" || raw === "flat" || raw === "masonry") return raw;
  return undefined;
}

// MOCK: masonry layout uses CSS column-count as a placeholder until the real
// masonry primitive lands. The column breaks are browser-driven and not
// height-balanced; the emitted stream and the enum value are real.
const MASONRY_COLUMN_CLASS =
  "columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4 [&>*]:block";

const SORT_OPTIONS: ShelfSortChoice[] = [
  { field: "manual", order: "desc", label: m.shelf_sort_manual },
  { field: "manual", order: "asc", label: m.shelf_sort_manual_reversed },
  { field: "addedAt", order: "desc", label: m.shelf_sort_newest },
  { field: "addedAt", order: "asc", label: m.shelf_sort_oldest },
  { field: "title", order: "asc", label: m.shelf_sort_title_az },
  { field: "title", order: "desc", label: m.shelf_sort_title_za },
];

const VIEW_OPTIONS: ShelfViewChoice[] = [
  { value: "nested", label: m.shelf_view_nested },
  { value: "flat", label: m.shelf_view_list },
  // { value: "masonry", label: "Grid" },
];

const PAGE_SIZE = 20;

function streamEntryKey(prefix: string, entry: ShelfStreamEntry): string {
  if (entry.kind === "root") return `${prefix}:r:${entry.unit.unit.unitId}`;
  if (entry.kind === "child")
    return `${prefix}:c:${entry.parentUnitId}:${entry.unit.unit.unitId}`;
  return `${prefix}:p:${entry.unit.unit.unitId}`;
}

export function ShelfPage({ unitId }: ShelfPageProps) {
  const navigate = useNavigate();
  const [viewModeOverride, setViewModeOverride] = useState<{
    unitId: string;
    value: ShelfView | undefined;
  }>({ unitId, value: undefined });
  const [sortState, setSortState] = useState<ShelfSortState>({
    field: "manual",
    order: "desc",
  });
  const [sortPrimeOnly, setSortPrimeOnly] = useState<boolean>(true);
  const [pageState, setPageState] = useState({ unitId, page: 1 });
  const isCompactLayout = useMediaQuery("(max-width: 639px)");

  const detailQuery = useQuery(shelfDetailQuery(unitId));
  const itemsQuery = useInfiniteQuery(
    shelfUnitsInfiniteQuery(unitId, { limit: 100 }),
  );
  const {
    data: itemsData,
    fetchNextPage,
    hasNextPage,
    isError: isItemsError,
    isFetchingNextPage,
    isLoading: isItemsLoading,
  } = itemsQuery;

  const shelf = detailQuery.data;
  const units = useMemo(
    () => itemsData?.pages.flatMap((page) => page.units) ?? [],
    [itemsData?.pages],
  );
  const relations = useMemo(
    () =>
      dedupeRelations(itemsData?.pages.flatMap((page) => page.relations) ?? []),
    [itemsData?.pages],
  );
  const translation = shelf ? getTranslation(shelf.translations) : undefined;
  const title = translation?.title ?? m.shelf_title();
  const description = contentDocMarkdownFallback(translation?.description);

  const savedViewMode = normalizePersistedViewMode(
    (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
  );
  const selectedViewMode =
    viewModeOverride.unitId === unitId ? viewModeOverride.value : undefined;
  const effectiveViewMode = selectedViewMode ?? savedViewMode ?? "nested";

  const hydration = useHydratedShelfUnits(units);
  const currentUser = useUserProfileStore((s) => s.user);
  const isOwner = !!currentUser && currentUser.unitId === shelf?.userId;
  const canEditShelf = useCanEdit({ resource: "shelf", ownerUnit: shelf });
  const cleanupMutation = useCleanupOrphansMutation();

  const orphanIds = useMemo(
    () => new Set(hydration.orphanUnitIds),
    [hydration.orphanUnitIds],
  );

  const stream = useMemo(
    () =>
      deriveShelfStream(
        hydration.enriched,
        relations,
        effectiveViewMode,
        sortState,
        sortPrimeOnly,
      ),
    [
      hydration.enriched,
      relations,
      effectiveViewMode,
      sortState,
      sortPrimeOnly,
    ],
  );

  const filteredStream = useMemo(
    () => stream.filter((e) => !orphanIds.has(e.unit.unit.unitId)),
    [stream, orphanIds],
  );
  const totalItemCount = Math.max(filteredStream.length, shelf?.itemCount ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItemCount / PAGE_SIZE));
  const page = pageState.unitId === unitId ? pageState.page : 1;
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStream = filteredStream.slice(pageStart, pageStart + PAGE_SIZE);
  const waitingForPageData =
    hasNextPage &&
    pageStart >= filteredStream.length &&
    filteredStream.length > 0;

  useEffect(() => {
    setPageState((current) => {
      const currentPage = current.unitId === unitId ? current.page : 1;
      const nextPage = Math.min(currentPage, totalPages);
      if (current.unitId === unitId && current.page === nextPage) {
        return current;
      }
      return { unitId, page: nextPage };
    });
  }, [totalPages, unitId]);

  useEffect(() => {
    if (waitingForPageData && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, isFetchingNextPage, waitingForPageData]);

  const reactionTargetIds = useMemo(() => {
    const ids = new Set<string>();
    if (shelf?.unitId) ids.add(shelf.unitId);
    for (const entry of visibleStream) {
      const data = entry.unit.data as
        | { unitId?: string; id?: string }
        | undefined;
      const id = data?.unitId ?? data?.id ?? entry.unit.unit.unitId;
      if (id) ids.add(id);
    }
    return [...ids];
  }, [shelf?.unitId, visibleStream]);
  useReactionHydration(reactionTargetIds);
  useCollectionStatusHydration(reactionTargetIds, {
    enabled: !!currentUser,
  });

  const reactionPost = useMemo<ReactionBarPost | null>(
    () => (shelf?.unitId ? { unitId: shelf.unitId } : null),
    [shelf?.unitId],
  );

  const showSortScopeToggle =
    (effectiveViewMode === "flat" || effectiveViewMode === "masonry") &&
    sortState.field !== "manual";
  const streamKeyPrefix = `${effectiveViewMode}:${sortState.field}:${
    sortState.order
  }:${sortPrimeOnly ? "prime" : "all"}`;

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
    <div className="w-full">
      {shelf?.coverUrl && (
        <div
          className="relative mx-auto w-full max-w-5xl overflow-hidden"
          style={{ aspectRatio: shelfCoverImageSpec.aspectRatio }}
        >
          <img
            src={shelf.coverUrl}
            alt={m.shelf_cover_alt({ title })}
            className="h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--colors-surface-canvas) 58%, transparent) 45%, var(--colors-surface-canvas) 88%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--colors-surface-canvas))",
            }}
          />
          <div className="absolute inset-0 z-10 flex flex-col justify-end gap-4 p-4 sm:p-6 md:flex-row md:items-end md:justify-between md:gap-5 md:p-8">
            <div className="min-w-0 flex-1">
              <h1 className="line-clamp-2 text-2xl font-semibold leading-[1.3] text-text-primary">
                {title}
              </h1>
              {description && (
                <p className="mt-2 line-clamp-2 max-w-2xl text-base text-text-secondary">
                  {description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                <span>
                  {m.shelf_items_count({ count: shelf?.itemCount ?? 0 })}
                </span>
                {shelf?.user?.name && (
                  <span>{m.shelf_by_author({ name: shelf.user.name })}</span>
                )}
              </div>
            </div>

            {(reactionPost || (canEditShelf && shelf?.unitId)) && (
              <div className="flex flex-row items-center gap-2 self-start md:flex-col md:items-end md:self-end">
                {canEditShelf && shelf?.unitId && !isCompactLayout && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-text-secondary hover:text-text-primary"
                    onClick={handleEditShelf}
                  >
                    <EditIcon className="h-4 w-4" />
                    {m.shelf_edit_action()}
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
                          <span>{m.shelf_edit_action()}</span>
                        </DropdownMenuItem>
                      ) : null
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
        {!shelf?.coverUrl && (
          <div className="flex flex-col gap-5 border-b border-border-whisper pb-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-[1.3]">{title}</h1>
              {description && (
                <p className="mt-2 max-w-2xl text-base text-text-secondary">
                  {description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                <span>
                  {m.shelf_items_count({ count: shelf?.itemCount ?? 0 })}
                </span>
                {shelf?.user?.name && (
                  <span>{m.shelf_by_author({ name: shelf.user.name })}</span>
                )}
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
                    {m.shelf_edit_action()}
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
                          <span>{m.shelf_edit_action()}</span>
                        </DropdownMenuItem>
                      ) : null
                    }
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ShelfSortViewPicker
              sort={sortState}
              sortOptions={SORT_OPTIONS}
              view={effectiveViewMode}
              viewOptions={VIEW_OPTIONS}
              onSortChange={setSortState}
              onViewChange={(value) => setViewModeOverride({ unitId, value })}
              sortHeading={m.shelf_controls_sort_by()}
              viewHeading={m.shelf_controls_view()}
            />
            {showSortScopeToggle && (
              <Label className="flex min-w-0 items-center gap-2 text-sm">
                <Checkbox
                  checked={sortPrimeOnly}
                  onCheckedChange={(checked) =>
                    setSortPrimeOnly(checked === true)
                  }
                />
                <span className="whitespace-nowrap">
                  {m.shelf_sort_prime_only()}
                </span>
              </Label>
            )}
            {hydration.orphanUnitIds.length > 0 && (
              <>
                <span className="text-xs text-warning-text">
                  {m.shelf_orphan_count({
                    count: hydration.orphanUnitIds.length,
                  })}
                </span>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={cleanupMutation.isPending}
                    onClick={() =>
                      cleanupMutation.mutate({
                        shelfId: unitId,
                        input: { orphanUnitIds: hydration.orphanUnitIds },
                      })
                    }
                  >
                    {m.shelf_cleanup_orphans()}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {isItemsLoading || waitingForPageData || isFetchingNextPage ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : isItemsError ? (
          <p className="py-8 text-center text-error">
            {m.shelf_items_load_failed()}
          </p>
        ) : visibleStream.length === 0 ? (
          <p className="py-8 text-center text-text-secondary">
            {m.shelf_empty_items()}
          </p>
        ) : effectiveViewMode === "masonry" ? (
          <div className={MASONRY_COLUMN_CLASS}>
            {visibleStream.map((entry) => (
              <ShelfItemRenderer
                key={streamEntryKey(streamKeyPrefix, entry)}
                entry={entry}
                viewMode={effectiveViewMode}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleStream.map((entry) => (
              <ShelfItemRenderer
                key={streamEntryKey(streamKeyPrefix, entry)}
                entry={entry}
                viewMode={effectiveViewMode}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page === 1}
              onClick={() =>
                setPageState((current) => ({
                  unitId,
                  page: Math.max(
                    1,
                    (current.unitId === unitId ? current.page : page) - 1,
                  ),
                }))
              }
            >
              {m.common_prev()}
            </Button>
            <span className="text-sm text-text-secondary">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={page === totalPages}
              onClick={() =>
                setPageState((current) => ({
                  unitId,
                  page: Math.min(
                    totalPages,
                    (current.unitId === unitId ? current.page : page) + 1,
                  ),
                }))
              }
            >
              {m.common_next()}
            </Button>
          </div>
        )}

        {shelf?.unitId && <ShelfDiscussionSection shelfUnitId={shelf.unitId} />}
      </div>
    </div>
  );
}

function dedupeRelations<
  T extends { parentUnitId: string; childUnitId: string; role: string },
>(relations: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const relation of relations) {
    const key = `${relation.parentUnitId}:${relation.childUnitId}:${relation.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(relation);
  }
  return out;
}
