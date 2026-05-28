import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { Link } from "@/shared/ui/link";
import { buildUnitUrl } from "@/shared/utils/build-url";
type Unit = UnitDTO;

type UnitsPageMode = "tab" | "single";

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
                {item.translations?.[0]?.title ||
                  t("book:unit_untitled_content")}
              </p>
            </div>
            {item.translations?.[0]?.description && (
              <p className="text-sm text-text-secondary line-clamp-4">
                {contentDocMarkdownFallback(item.translations[0].description)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface UnitsPageProps {
  /**
   * Mode of the page:
   * - 'tab': show tabs to switch between multiple unit types
   * - 'single': only query and render a single `type`, no tabs UI
   */
  mode?: UnitsPageMode;
  /**
   * The unit type to query when `mode` is 'single'
   */
  type?: string;
  /**
   * Unit types to display when `mode` is 'tab'
   */
  types?: string[];
  /**
   * Optional user filter
   */
  userId?: string;
  /**
   * Optional target unit filter (e.g., bookId)
   */
  targetUnitId?: string;
  workUnitId?: string;

  children?: (units: any[]) => React.ReactNode;
}

export const UnitsPage: React.FC<UnitsPageProps> = ({
  mode = "tab",
  type,
  types = ["UNIT", "POST", "QUOTE", "BOOK"],
  userId,
  targetUnitId,
  workUnitId,
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
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [tab, setTab] = useState<string>(types[0] ?? "");
  const [startMap, setStartMap] = useState<Record<string, number>>({});

  // initialize tab from URL (only in tab mode)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSingle,
    types.includes,
    types.length,
    type,
    types[0],
    searchParams.get,
  ]);

  // ensure startMap has keys for current tabTypes
  useEffect(() => {
    setStartMap((prev) => {
      const next = { ...prev };
      types.forEach((t) => {
        if (next[t] == null) next[t] = 0;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.forEach]);

  const { data: activeData, isLoading } = useQuery(
    contentSearchQueryOptions({
      type: tab === "UNIT" ? undefined : tab,
      userId,
      ...(workUnitId
        ? { workUnitId, workRoles: ["POST" as const] }
        : targetUnitId
          ? { containedUnitIds: [targetUnitId] }
          : {}),
      keyword: keyword || undefined,
      offset: startMap[tab] ?? 0,
      limit: EXTERNAL_PAGE_SIZE,
    }),
  );

  function handleNeedMoreData(page: number) {
    const externalStart = (page - 1) * EXTERNAL_PAGE_SIZE;
    const t = tab;
    setStartMap((prev) => ({ ...prev, [t]: externalStart }));
  }

  async function handlePreRequestData(page: number) {
    const start = (page - 1) * EXTERNAL_PAGE_SIZE;
    const nextData = await queryClient.fetchQuery(
      contentSearchQueryOptions({
        type: tab === "UNIT" ? undefined : tab,
        userId,
        ...(workUnitId
          ? { workUnitId, workRoles: ["POST" as const] }
          : targetUnitId
            ? { containedUnitIds: [targetUnitId] }
            : {}),
        keyword: keyword || undefined,
        offset: start,
        limit: EXTERNAL_PAGE_SIZE,
      }),
    );
    return nextData?.items?.length ?? 0;
  }

  useEffect(() => {
    ref.current?.resetPaginationPageNumber?.();
    setCurrentPage(1);
  }, []);

  const units: Unit[] = useMemo(
    () => (activeData?.items ?? []) as unknown as Unit[],
    [activeData],
  );
  const totalItems: number = activeData?.total ?? 0;

  return (
    <div className="mx-auto max-w-7xl p-4 mt-4">
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
                    {types.map((t) => (
                      <TabsTrigger key={t} value={t}>
                        {t}
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

export default UnitsPage;
