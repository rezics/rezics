import { contentSearchQueryOptions } from "@rezics/contract/api/meili/meili.queries";
import { contentDocMarkdownFallback, type UnitDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  UniversalPaginator,
  type UniversalPaginatorHandle,
} from "@rezics/ui/composite/pagination/Pagination.tsx";
import {
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeywordInput, useSearchQuery } from "@/search";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import { buildUnitUrl } from "@/shared/utils/build-url";
import { mapContentSearchDocToUnitDTO } from "../models/contentSearchDocToUnitDTO";

type Unit = UnitDTO;

type UnitsPageMode = "tab" | "single";

export interface UnitsPageProps {
  /**
   * Mode of the page:
   * - 'tab': show tabs to switch between multiple unit types
   * - 'single': only query and render a single `type`, no tabs UI
   * 页面模式：
   * - 'tab'：显示标签页以在多个 unit 类型之间切换
   * - 'single'：仅查询并渲染单个 `type`，无标签页 UI
   */
  mode?: UnitsPageMode;
  /**
   * The unit type to query when `mode` is 'single'
   * `mode` 为 'single' 时要查询的 unit 类型
   */
  type?: string;
  /**
   * Unit types to display when `mode` is 'tab'
   * `mode` 为 'tab' 时要显示的 unit 类型
   */
  types?: string[];
  /**
   * Optional user filter
   * 可选的用户筛选条件
   */
  userId?: string;
  /**
   * Optional target unit filter (e.g., bookId)
   * 可选的目标 unit 筛选条件（如 bookId）
   */
  targetUnitId?: string;

  children?: (units: any[]) => React.ReactNode;
}

/**
 * Searchable units page with keyword input, multi-type tabs, and paginated
 * results. Supports custom filters by user and target unit, with optional
 * children renderer for custom result layouts.
 * 可搜索的 unit 页面，包含关键词输入、多类型标签和分页结果。支持按用户和目标 unit 的自定义筛选，
 * 具有可选的子渲染器用于自定义结果布局。
 *
 * Mobile <640px:
 * +--[max-w-7xl]--+
 * | KeywordInput |
 * | [Tab][Tab]   |
 * | +----------+ |
 * | |Unit Item | |
 * | |Badge Type| |
 * | |Title     | |
 * | |Descr...  | |
 * | +----------+ |
 * | +----------+ |
 * | |Unit Item | |
 * | +----------+ |
 * | [Pagination] |
 * +-------------+
 *
 * Tablet 640-1023px:
 * +-----[max-w-7xl]-----+
 * | KeywordInput        |
 * | [Tab][Tab][Tab]     |
 * | +-------+-------+   |
 * | |Badge |Title   |   |
 * | |Type  |Description |
 * | |      |...      |   |
 * | +-------+-------+   |
 * | +-------+-------+   |
 * | |Badge |Title   |   |
 * | |Type  |Description |
 * | +-------+-------+   |
 * | [Pagination]        |
 * +---------------------+
 *
 * Desktop 1024-1535px:
 * +----------[max-w-7xl]----------+
 * | KeywordInput                 |
 * | [Tab][Tab][Tab][Tab]         |
 * | +-----------+---------------+ |
 * | |Badge Type | Title         | |
 * | |           | Description   | |
 * | |           | ...           | |
 * | +-----------+---------------+ |
 * | +-----------+---------------+ |
 * | |Badge Type | Title         | |
 * | |           | Description   | |
 * | +-----------+---------------+ |
 * | [Pagination]                 |
 * +------------------------------+
 *
 * Ultra-wide >=1536px:
 * +----------[max-w-7xl]----------+
 * | KeywordInput                 |
 * | [Tab][Tab][Tab][Tab]         |
 * | +-----------+---------------+ |
 * | |Badge Type | Title         | |
 * | |           | Description   | |
 * | |           | Full text...  | |
 * | +-----------+---------------+ |
 * | +-----------+---------------+ |
 * | |Badge Type | Title         | |
 * | |           | Description   | |
 * | |           | Full text...  | |
 * | +-----------+---------------+ |
 * | [Pagination]                 |
 * +------------------------------+
 */
export const UnitsPage: React.FC<UnitsPageProps> = ({
  mode = "tab",
  type,
  types = ["UNIT", "POST", "QUOTE", "BOOK"],
  userId,
  targetUnitId,
  children,
}) => {
  const { t } = useTranslation(["book"]);
  const ref = useRef<UniversalPaginatorHandle>(null);
  const queryClient = useQueryClient();
  const routerSearch = useRouterState({
    select: (s) => s.location.search ?? "",
  });
  const searchParams = useMemo(
    () => new URLSearchParams(routerSearch),
    [routerSearch],
  );

  const isSingle = mode === "single";

  const EXTERNAL_PAGE_SIZE = 50;

  const search = useSearchQuery({});
  const readContext = useReadLanguageContext();
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tab, setTab] = useState<string>(types[0] ?? "");
  const [startMap, setStartMap] = useState<Record<string, number>>({});

  // Stable serialization of `types` for use as a dependency.
  // 将 `types` 稳定序列化，用作依赖项。
  const typesKey = JSON.stringify(types);

  // Initialize tab from URL (only in tab mode).
  // 从 URL 初始化标签页（仅在 tab 模式下）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: typesKey is a stable serialization of types — listing types directly would cause infinite re-renders.
  useEffect(() => {
    if (isSingle) {
      if (type && types.includes(type)) {
        setTab(type);
      } else if (types.length > 0) {
        setTab(types[0]);
      }
      return;
    }
    const tabParam = searchParams.get("tab");
    if (tabParam && types.includes(tabParam)) {
      setTab(tabParam);
    } else if (types.length > 0) {
      setTab(types[0]);
    }
  }, [isSingle, typesKey, type, searchParams]);

  // Ensure startMap has keys for current tabTypes.
  // 确保 startMap 为当前的 tabTypes 都有对应的键。
  // biome-ignore lint/correctness/useExhaustiveDependencies: typesKey is a stable serialization of types — listing types directly would cause infinite re-renders.
  useEffect(() => {
    setStartMap((prev) => {
      const next = { ...prev };
      for (const t of types) {
        if (next[t] == null) next[t] = 0;
      }
      return next;
    });
  }, [typesKey]);

  const searchOptions = {
    type: tab === "UNIT" ? undefined : tab,
    userId,
    ...(targetUnitId ? { containedUnitIds: [targetUnitId] } : {}),
    keyword: keyword || undefined,
    offset: startMap[tab] ?? 0,
    limit: EXTERNAL_PAGE_SIZE,
  };
  const { data: activeData, isLoading } =
    useLocalizedContentSearch(searchOptions);

  function localizedOptions(offset: number) {
    return {
      type: tab === "UNIT" ? undefined : tab,
      userId,
      ...(targetUnitId ? { containedUnitIds: [targetUnitId] } : {}),
      keyword: keyword || undefined,
      offset,
      limit: EXTERNAL_PAGE_SIZE,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
  }

  function handleNeedMoreData(page: number) {
    const externalStart = (page - 1) * EXTERNAL_PAGE_SIZE;
    const t = tab;
    setStartMap((prev) => ({ ...prev, [t]: externalStart }));
  }

  async function handlePreRequestData(page: number) {
    const start = (page - 1) * EXTERNAL_PAGE_SIZE;
    const nextData = await queryClient.fetchQuery(
      contentSearchQueryOptions(localizedOptions(start)),
    );
    return nextData?.items?.length ?? 0;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }, []);

  const units: Unit[] = useMemo(
    () => (activeData?.items ?? []).map(mapContentSearchDocToUnitDTO),
    [activeData],
  );
  const totalItems: number = activeData?.total ?? 0;

  return (
    <div className="w-full mx-auto max-w-7xl p-4 mt-4">
      <UniversalPaginator<Unit>
        ref={ref}
        data={units}
        totalExternalItems={totalItems}
        itemsPerPage={10}
        externalItemsPerPage={EXTERNAL_PAGE_SIZE}
        sortType={undefined as any}
        sortOrder={undefined as any}
        onSortChange={() => {}}
        requestData={handleNeedMoreData}
        preRequestData={handlePreRequestData}
        isLoading={isLoading && units.length === 0}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        sortControl={
          <div className="mb-4">
            <KeywordInput
              value={keywordBind.value ?? ""}
              onChange={(v) => keywordBind.onChange(v)}
              placeholder={t("book:units_search_placeholder")}
            />
            {!isSingle && (
              <div className="mt-4 mb-4 border-b border-border-whisper">
                <Tabs value={tab} onValueChange={(v) => setTab(v)}>
                  <TabsList aria-label={t("book:unit_type_tabs_label")}>
                    {types.map((type) => (
                      <TabsTrigger key={type} value={type}>
                        {type}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            )}
          </div>
        }
      >
        {(currentPageItems: Unit[]) =>
          children
            ? children(currentPageItems)
            : defaultChildren(currentPageItems, t)
        }
      </UniversalPaginator>
    </div>
  );
};

function defaultChildren(units: Unit[], t: (key: string) => string) {
  return (
    <div className="space-y-3">
      {units.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between rounded-md bg-surface-elevated px-3 py-2 shadow-sm"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <Link to={buildUnitUrl(item)} {...props}>
                        <Badge variant="outline" className="text-[11px]">
                          {item.type || "UNKNOWN"}
                        </Badge>
                      </Link>
                    )}
                  />
                  <TooltipContent>
                    {t("book:unit_open_content_page")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-base font-semibold truncate mb-1">
                {item.title || t("book:unit_untitled_content")}
              </p>
            </div>
            {item.description && (
              <p className="text-sm text-text-secondary line-clamp-4">
                {contentDocMarkdownFallback(item.description)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
