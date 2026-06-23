import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  shelf_sort_manual: () => getI18nRuntime().i18n.t("entity:shelf_sort_manual"),
  shelf_sort_manual_reversed: () =>
    getI18nRuntime().i18n.t("entity:shelf_sort_manual_reversed"),
  shelf_sort_newest: () => getI18nRuntime().i18n.t("entity:shelf_sort_newest"),
  shelf_sort_oldest: () => getI18nRuntime().i18n.t("entity:shelf_sort_oldest"),
  shelf_sort_title_az: () =>
    getI18nRuntime().i18n.t("entity:shelf_sort_title_az"),
  shelf_sort_title_za: () =>
    getI18nRuntime().i18n.t("entity:shelf_sort_title_za"),
  shelf_view_nested: () => getI18nRuntime().i18n.t("entity:shelf_view_nested"),
  shelf_view_list: () => getI18nRuntime().i18n.t("entity:shelf_view_list"),
  shelf_view_bookshelf: () =>
    getI18nRuntime().i18n.t("entity:shelf_view_bookshelf"),
} as const;

import { useCanEdit } from "@rezics/api/hooks";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { ShelfSortState, ShelfView } from "@rezics/api/shelf";
import {
  shelfDetailQuery,
  shelfItemsInfiniteQuery,
  useCleanupOrphansMutation,
  useHydratedShelfItems,
  useShelfItemStatusHydration,
} from "@rezics/api/shelf";
import {
  contentDocMarkdownFallback,
  isLibraryKind,
  type ShelfItemChildDTO,
  shelfCoverImageSpec,
  shelfItemIdentity,
  shelfItemReference,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Button,
  Checkbox,
  DropdownMenuItem,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as EditIcon, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QueryBoundary } from "@/core";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { useMediaQuery } from "@/shared/utils/use-media-query";
import { useUserProfileStore } from "@/user";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import {
  type ShelfSortChoice,
  ShelfSortViewPicker,
  type ShelfViewChoice,
} from "../components/ShelfSortViewPicker";
import { filterReadableEntries } from "../models/readableFilter";
import { shelfDetailActions, shelfPolicy } from "../models/shelfPolicy";
import {
  deriveShelfStream,
  type ShelfStreamEntry,
} from "../models/shelfStream";
import { normalizeShelfViewMode } from "../models/shelfViewMode";
import { ShelfDiscussionSection } from "../sections/ShelfDiscussionSection";

interface ShelfPageProps {
  unitId: string;
}

const SORT_OPTIONS: ShelfSortChoice[] = [
  { field: "manual", order: "desc", label: i18nMessages.shelf_sort_manual },
  {
    field: "manual",
    order: "asc",
    label: i18nMessages.shelf_sort_manual_reversed,
  },
  { field: "addedAt", order: "desc", label: i18nMessages.shelf_sort_newest },
  { field: "addedAt", order: "asc", label: i18nMessages.shelf_sort_oldest },
  { field: "title", order: "asc", label: i18nMessages.shelf_sort_title_az },
  { field: "title", order: "desc", label: i18nMessages.shelf_sort_title_za },
];

const VIEW_OPTIONS: ShelfViewChoice[] = [
  { value: "nested", label: i18nMessages.shelf_view_nested },
  { value: "flat", label: i18nMessages.shelf_view_list },
  { value: "bookshelf", label: i18nMessages.shelf_view_bookshelf },
];

const PAGE_SIZE = 20;

function streamEntryKey(prefix: string, entry: ShelfStreamEntry): string {
  if (entry.kind === "root")
    return `${prefix}:r:${shelfItemIdentity(entry.unit.unit)}`;
  if (entry.kind === "child")
    return `${prefix}:c:${entry.parentUnitId}:${shelfItemIdentity(entry.unit.unit)}`;
  return `${prefix}:p:${shelfItemIdentity(entry.unit.unit)}`;
}

export function ShelfPage({ unitId }: ShelfPageProps) {
  const { t } = useTranslation(["common", "entity"]);
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
  const [itemSearchText, setItemSearchText] = useState("");
  // Standalone shelf pages expose the readable filter as opt-in (default off);
  // progress/profile library compositions can apply their own defaults.
  // 独立 shelf 页面将 readable 过滤器作为可选项暴露（默认关闭）；
  // 进度/profile 书库组合可应用自己的默认值。
  const [readableOnly, setReadableOnly] = useState<boolean>(false);
  const [pageState, setPageState] = useState({ unitId, page: 1 });
  const isCompactLayout = useMediaQuery("(max-width: 639px)");
  const readContext = useReadLanguageContext();

  // Primary shelf detail query — drives QueryBoundary loading/error/not-found states.
  // 主书架详情查询 —— 驱动 QueryBoundary 的加载/错误/未找到状态。
  const detailQuery = useQuery({
    ...shelfDetailQuery(unitId, {
      languages: readContext.languages.join(",") || undefined,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(unitId),
  });
  const normalizedItemSearchText = itemSearchText.trim();
  const shelfItemsQuery = useMemo(
    () => ({
      limit: 100,
      ...(normalizedItemSearchText
        ? { q: normalizedItemSearchText }
        : undefined),
    }),
    [normalizedItemSearchText],
  );
  const itemsQuery = useInfiniteQuery(
    shelfItemsInfiniteQuery(unitId, shelfItemsQuery),
  );
  const {
    data: itemsData,
    fetchNextPage,
    hasNextPage,
    isError: isItemsError,
    isFetchingNextPage,
    isLoading: isItemsLoading,
  } = itemsQuery;

  // shelf may be undefined while the query is pending — all derived state below
  // uses optional chaining and resolves to safe defaults in that window.
  // shelf 在查询挂起期间可能为 undefined ——以下所有派生状态均使用可选链并解析为安全默认值。
  const shelf = detailQuery.data;
  const units = useMemo(
    () => itemsData?.pages.flatMap((page) => page.items) ?? [],
    [itemsData?.pages],
  );
  const relations = useMemo(
    () =>
      dedupeRelations(itemsData?.pages.flatMap((page) => page.relations) ?? []),
    [itemsData?.pages],
  );
  const title = shelf?.title ?? t("entity:shelf_title");
  const description = contentDocMarkdownFallback(shelf?.description);

  const savedViewMode = normalizeShelfViewMode(
    (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
  );
  const selectedViewMode =
    viewModeOverride.unitId === unitId ? viewModeOverride.value : undefined;
  const effectiveViewMode = selectedViewMode ?? savedViewMode;

  const hydration = useHydratedShelfItems(units);
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
    () => stream.filter((e) => !orphanIds.has(shelfItemReference(e.unit.unit))),
    [stream, orphanIds],
  );
  const readableStream = useMemo(
    () => filterReadableEntries(filteredStream, readableOnly),
    [filteredStream, readableOnly],
  );
  const displayStream = useMemo(
    () =>
      effectiveViewMode === "bookshelf"
        ? readableStream.filter((entry) => isLibraryKind(entry.unit.unit.kind))
        : readableStream,
    [effectiveViewMode, readableStream],
  );
  const bookshelfFilteredCount =
    effectiveViewMode === "bookshelf"
      ? readableStream.length - displayStream.length
      : 0;
  const loadedPages = Math.max(1, Math.ceil(displayStream.length / PAGE_SIZE));
  const finalPageCount = hasNextPage ? null : loadedPages;
  const page = pageState.unitId === unitId ? pageState.page : 1;
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStream = displayStream.slice(pageStart, pageStart + PAGE_SIZE);
  const waitingForPageData =
    hasNextPage &&
    pageStart >= displayStream.length &&
    displayStream.length > 0;
  const canPageBackward = page > 1;
  const canPageForward = page < loadedPages || Boolean(hasNextPage);

  useEffect(() => {
    setPageState((current) => {
      const currentPage = current.unitId === unitId ? current.page : 1;
      const nextPage = finalPageCount
        ? Math.min(currentPage, finalPageCount)
        : currentPage;
      if (current.unitId === unitId && current.page === nextPage) {
        return current;
      }
      return { unitId, page: nextPage };
    });
  }, [finalPageCount, unitId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the normalized search text intentionally resets pagination when it changes.
  useEffect(() => {
    setPageState({ unitId, page: 1 });
  }, [
    normalizedItemSearchText,
    readableOnly,
    sortPrimeOnly,
    sortState,
    effectiveViewMode,
    unitId,
  ]);

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
      const id =
        data?.unitId ?? data?.id ?? shelfItemReference(entry.unit.unit);
      if (id) ids.add(id);
    }
    return [...ids];
  }, [shelf?.unitId, visibleStream]);
  useReactionHydration(reactionTargetIds);
  useShelfItemStatusHydration(reactionTargetIds, {
    enabled: !!currentUser,
  });

  const reactionPost = useMemo<ReactionBarPost | null>(
    () => (shelf?.unitId ? { unitId: shelf.unitId } : null),
    [shelf?.unitId],
  );
  const showSortScopeToggle =
    effectiveViewMode === "flat" && sortState.field !== "manual";
  const streamKeyPrefix = `${effectiveViewMode}:${sortState.field}:${
    sortState.order
  }:${sortPrimeOnly ? "prime" : "all"}`;

  const handleEditShelf = (shelfUnitId: string) => {
    navigate({
      to: "/shelf/$shelfId/edit",
      params: { shelfId: shelfUnitId },
    });
  };

  return (
    <QueryBoundary query={detailQuery}>
      {(resolvedShelf) => (
        <div className="w-full">
          {resolvedShelf.coverUrl && (
            <div
              className="relative mx-auto w-full max-w-5xl overflow-hidden"
              style={{ aspectRatio: shelfCoverImageSpec.aspectRatio }}
            >
              <img
                src={resolvedShelf.coverUrl}
                alt={t("entity:shelf_cover_alt", { title })}
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
                      {t("entity:shelf_items_count", {
                        count: resolvedShelf.itemCount ?? 0,
                      })}
                    </span>
                    {resolvedShelf.user?.name && (
                      <span>
                        {t("entity:shelf_by_author", {
                          name: resolvedShelf.user.name,
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {(reactionPost || (canEditShelf && resolvedShelf.unitId)) && (
                  <div className="flex flex-row items-center gap-2 self-start md:flex-col md:items-end md:self-end">
                    {canEditShelf &&
                      resolvedShelf.unitId &&
                      !isCompactLayout && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-text-secondary hover:text-text-primary"
                          onClick={() =>
                            handleEditShelf(resolvedShelf.unitId ?? "")
                          }
                        >
                          <EditIcon className="h-4 w-4" />
                          {t("entity:shelf_edit_action")}
                        </Button>
                      )}
                    {reactionPost && (
                      <ReactionBar
                        post={reactionPost}
                        policy={shelfPolicy}
                        actions={shelfDetailActions}
                        className="flex-nowrap md:justify-end"
                        overflowContent={
                          isCompactLayout &&
                          canEditShelf &&
                          resolvedShelf.unitId ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleEditShelf(resolvedShelf.unitId ?? "")
                              }
                              className="gap-2"
                            >
                              <EditIcon className="h-4 w-4" />
                              <span>{t("entity:shelf_edit_action")}</span>
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
            {!resolvedShelf.coverUrl && (
              <div className="flex flex-col gap-5 border-b border-border-whisper pb-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold leading-[1.3]">
                    {title}
                  </h1>
                  {description && (
                    <p className="mt-2 max-w-2xl text-base text-text-secondary">
                      {description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span>
                      {t("entity:shelf_items_count", {
                        count: resolvedShelf.itemCount ?? 0,
                      })}
                    </span>
                    {resolvedShelf.user?.name && (
                      <span>
                        {t("entity:shelf_by_author", {
                          name: resolvedShelf.user.name,
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {(reactionPost || (canEditShelf && resolvedShelf.unitId)) && (
                  <div className="flex flex-row items-center gap-2 self-start md:flex-col md:items-end">
                    {canEditShelf &&
                      resolvedShelf.unitId &&
                      !isCompactLayout && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-text-secondary hover:text-text-primary"
                          onClick={() =>
                            handleEditShelf(resolvedShelf.unitId ?? "")
                          }
                        >
                          <EditIcon className="h-4 w-4" />
                          {t("entity:shelf_edit_action")}
                        </Button>
                      )}
                    {reactionPost && (
                      <ReactionBar
                        post={reactionPost}
                        policy={shelfPolicy}
                        actions={shelfDetailActions}
                        className="flex-nowrap md:justify-end"
                        overflowContent={
                          isCompactLayout &&
                          canEditShelf &&
                          resolvedShelf.unitId ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleEditShelf(resolvedShelf.unitId ?? "")
                              }
                              className="gap-2"
                            >
                              <EditIcon className="h-4 w-4" />
                              <span>{t("entity:shelf_edit_action")}</span>
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
                <div className="relative min-w-[min(100%,16rem)] flex-1 sm:flex-none">
                  <SearchIcon className="-translate-y-1/2 pointer-events-none absolute left-3 top-1/2 h-4 w-4 text-text-tertiary" />
                  <Input
                    value={itemSearchText}
                    onChange={(event) => setItemSearchText(event.target.value)}
                    placeholder={t("entity:shelf_item_search_placeholder")}
                    aria-label={t("common:search")}
                    className="h-9 pl-9"
                  />
                </div>
                <ShelfSortViewPicker
                  sort={sortState}
                  sortOptions={SORT_OPTIONS}
                  view={effectiveViewMode}
                  viewOptions={VIEW_OPTIONS}
                  onSortChange={setSortState}
                  onViewChange={(value) =>
                    setViewModeOverride({ unitId, value })
                  }
                  sortHeading={t("entity:shelf_controls_sort_by")}
                  viewHeading={t("entity:shelf_controls_view")}
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
                      {t("entity:shelf_sort_prime_only")}
                    </span>
                  </Label>
                )}
                <Label className="flex min-w-0 items-center gap-2 text-sm">
                  <Checkbox
                    checked={readableOnly}
                    onCheckedChange={(checked) =>
                      setReadableOnly(checked === true)
                    }
                  />
                  <span className="whitespace-nowrap">
                    {t("entity:shelf_readable_only")}
                  </span>
                </Label>
                {hydration.orphanUnitIds.length > 0 && (
                  <>
                    <span className="text-xs text-warning-text">
                      {t("entity:shelf_orphan_count", {
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
                            input: { orphanItemIds: hydration.orphanUnitIds },
                          })
                        }
                      >
                        {t("entity:shelf_cleanup_orphans")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {bookshelfFilteredCount > 0 && (
              <p className="text-xs leading-dense text-text-secondary">
                {t("entity:shelf_bookshelf_filtered_count", {
                  count: bookshelfFilteredCount,
                })}
              </p>
            )}

            {isItemsLoading ||
            hydration.isLoading ||
            waitingForPageData ||
            isFetchingNextPage ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : isItemsError ? (
              <p className="py-8 text-center text-error">
                {t("entity:shelf_items_load_failed")}
              </p>
            ) : visibleStream.length === 0 ? (
              <p className="py-8 text-center text-text-secondary">
                {normalizedItemSearchText
                  ? t("entity:shelf_item_no_search_matches")
                  : effectiveViewMode === "bookshelf" &&
                      readableStream.length > 0
                    ? t("entity:shelf_bookshelf_empty")
                    : t("entity:shelf_empty_items")}
              </p>
            ) : effectiveViewMode === "bookshelf" ? (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
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

            {(canPageBackward || canPageForward) && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canPageBackward}
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
                  {t("common:prev")}
                </Button>
                <span className="text-sm text-text-secondary">
                  {finalPageCount
                    ? `${page} / ${finalPageCount}`
                    : `${page} / ${loadedPages}+`}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canPageForward}
                  onClick={() =>
                    setPageState((current) => ({
                      unitId,
                      page:
                        (current.unitId === unitId ? current.page : page) + 1,
                    }))
                  }
                >
                  {t("common:next")}
                </Button>
              </div>
            )}

            {resolvedShelf.unitId && (
              <ShelfDiscussionSection shelfItemId={resolvedShelf.unitId} />
            )}
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

function dedupeRelations(
  relations: readonly (ShelfItemChildDTO | undefined)[],
): ShelfItemChildDTO[] {
  const seen = new Set<string>();
  const out: ShelfItemChildDTO[] = [];
  for (const relation of relations) {
    if (!relation) continue;
    const key = `${relation.parentItemType}:${relation.parentItemId}:${relation.childItemType}:${relation.childItemId}:${relation.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(relation);
  }
  return out;
}
