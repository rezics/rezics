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
} as const;

import { useCanEdit } from "@rezics/api/hooks";
import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type {
  EnrichedShelfItem,
  ShelfSortState,
  ShelfView,
} from "@rezics/api/shelf";
import {
  shelfDetailQuery,
  shelfItemsInfiniteQuery,
  useCleanupOrphansMutation,
  useHydratedShelfItems,
  useShelfItemStatusHydration,
} from "@rezics/api/shelf";
import {
  contentDocMarkdownFallback,
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
import { QueryErrorDisplay } from "@/core";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { getTranslation } from "@/shared/utils/translation-helpers";
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
import { ShelfDiscussionSection } from "../sections/ShelfDiscussionSection";

interface ShelfPageProps {
  unitId: string;
}

/**
 * Legacy view-mode values map forward (review to nested, list to flat, grid to
 * masonry); unknown to nested. No data migration — the legacy value is
 * overwritten on next write.
 * 旧的 view-mode 值向前映射（review 映射为 nested、list 映射为 flat、grid 映射为
 * masonry）；未知值映射为 nested。不做数据迁移 —— 旧值会在下次写入时被覆盖。
 */
function normalizePersistedViewMode(raw: unknown): ShelfView | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw === "nested" || raw === "flat" || raw === "masonry") return raw;
  return undefined;
}

// MOCK: masonry layout uses CSS column-count as a placeholder until the real
// masonry primitive lands. The column breaks are browser-driven and not
// height-balanced; the emitted stream and the enum value are real.
// MOCK：masonry 布局使用 CSS column-count 作为占位，直到真正的 masonry 基础组件落地。
// 列断点由浏览器驱动且不做高度平衡；但发出的 stream 和枚举值是真实的。
const MASONRY_COLUMN_CLASS =
  "columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4 [&>*]:block";

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
  // { value: "masonry", label: "Grid" },
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

  const detailQuery = useQuery(shelfDetailQuery(unitId));
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
  const translation = shelf ? getTranslation(shelf.translations) : undefined;
  const title = translation?.title ?? t("entity:shelf_title");
  const description = contentDocMarkdownFallback(translation?.description);

  const savedViewMode = normalizePersistedViewMode(
    (shelf?.extra as { viewMode?: unknown } | null | undefined)?.viewMode,
  );
  const selectedViewMode =
    viewModeOverride.unitId === unitId ? viewModeOverride.value : undefined;
  const effectiveViewMode = selectedViewMode ?? savedViewMode ?? "nested";

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
  const totalItemCount = Math.max(readableStream.length, shelf?.itemCount ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItemCount / PAGE_SIZE));
  const page = pageState.unitId === unitId ? pageState.page : 1;
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStream = readableStream.slice(pageStart, pageStart + PAGE_SIZE);
  const waitingForPageData =
    hasNextPage &&
    pageStart >= readableStream.length &&
    readableStream.length > 0;

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
    setPageState({ unitId, page: 1 });
  }, [unitId]);

  // Reset to first page when item search text changes.
  // 当搜索文本变化时重置到第一页。
  useEffect(() => {
    setPageState({ unitId, page: 1 });
  }, [normalizedItemSearchText, unitId]);

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

  // Shelf detail query failed — show error before content
  // 书架详情查询失败 —— 在内容之前显示错误
  if (detailQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <QueryErrorDisplay error={detailQuery.error} />
      </div>
    );
  }

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
                    count: shelf?.itemCount ?? 0,
                  })}
                </span>
                {shelf?.user?.name && (
                  <span>
                    {t("entity:shelf_by_author", { name: shelf.user.name })}
                  </span>
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
                      isCompactLayout && canEditShelf && shelf?.unitId ? (
                        <DropdownMenuItem
                          onClick={handleEditShelf}
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
                  {t("entity:shelf_items_count", {
                    count: shelf?.itemCount ?? 0,
                  })}
                </span>
                {shelf?.user?.name && (
                  <span>
                    {t("entity:shelf_by_author", { name: shelf.user.name })}
                  </span>
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
                      isCompactLayout && canEditShelf && shelf?.unitId ? (
                        <DropdownMenuItem
                          onClick={handleEditShelf}
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
              onViewChange={(value) => setViewModeOverride({ unitId, value })}
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
                onCheckedChange={(checked) => setReadableOnly(checked === true)}
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

        {isItemsLoading || waitingForPageData || isFetchingNextPage ? (
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
              : t("entity:shelf_empty_items")}
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
              {t("common:prev")}
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
              {t("common:next")}
            </Button>
          </div>
        )}

        {shelf?.unitId && <ShelfDiscussionSection shelfItemId={shelf.unitId} />}
      </div>
    </div>
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
