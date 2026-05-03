import {
  ArrowDown as ArrowDownward,
  ArrowUp as ArrowUpward,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type React from "react";
import { useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shadcn/button";
import { Label } from "@/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/select";
import { ToggleGroup, ToggleGroupItem } from "@/shadcn/toggle-group";

/**
 * example:
 * ```ts
 *   const [sortConfig, setSortConfig] = useState<{
 *       type: "time" | "name" | "popular" | "agree";
 *       order: "asc" | "desc";
 *   }>({
 *       type: "popular",
 *       order: "desc",
 *   });
 *   ```
 */
export interface SortControlsProps {
  sortType: string;
  sortOrder: "asc" | "desc";
  onSortChange: (newSort: { type?: string; order?: "asc" | "desc" }) => void;
}

const SortControls: React.FC<SortControlsProps> = ({
  sortType,
  sortOrder,
  onSortChange,
}) => {
  const sortOptions = [
    { value: "time", label: "按时间" },
    { value: "name", label: "按名称" },
    { value: "popular", label: "按热度" },
    { value: "agree", label: "按赞同数" },
  ];
  return (
    <div className="rounded-md p-2 mb-2 flex flex-wrap items-center gap-2">
      <div className="flex flex-col gap-1 min-w-[150px]">
        <Label htmlFor="sort-type">排序方式</Label>
        <Select
          value={sortType}
          onValueChange={(v) => onSortChange({ type: v })}
        >
          <SelectTrigger id="sort-type" size="sm" className="w-full">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ToggleGroup
        type="single"
        value={sortOrder}
        onValueChange={(v: string) =>
          (v === "asc" || v === "desc") && onSortChange({ order: v })
        }
        variant="outline"
      >
        <ToggleGroupItem value="desc" aria-label="降序">
          <ArrowDownward className="size-4" />
          <span className="ml-1">降序</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="asc" aria-label="升序">
          <ArrowUpward className="size-4" />
          <span className="ml-1">升序</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

interface PaginationBarProps {
  page: number;
  dataLength: number;
  totalPages: number;
  onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
}

function getPageRange(current: number, total: number, siblings = 1): number[] {
  const range = new Set<number>();
  range.add(1);
  range.add(total);
  for (let i = current - siblings; i <= current + siblings; i++) {
    if (i >= 1 && i <= total) range.add(i);
  }
  return Array.from(range).sort((a, b) => a - b);
}

const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  dataLength,
  totalPages,
  onPageChange,
}) => {
  const { t } = useTranslation();
  useEffect(() => {
    console.log(
      "PaginationBar",
      JSON.stringify({
        page: page,
        dataLength: dataLength,
        totalPages: totalPages,
      }),
    );
  }, [page, dataLength, totalPages]);
  if (totalPages <= 1) return null;
  // dataLength is the visible page count for the paginator; mirror MUI behavior
  // where `count` is the number of buttons shown.
  const visibleTotal = dataLength;
  const pages = getPageRange(page, visibleTotal, 1);

  const go = (target: number) => {
    if (target < 1 || target > visibleTotal) return;
    onPageChange(null as unknown as React.ChangeEvent<unknown>, target);
  };

  return (
    <div>
      <div className="flex justify-center items-center gap-1 p-2 mt-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="第一页"
          disabled={page <= 1}
          onClick={() => go(1)}
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, idx) => {
          const prev = pages[idx - 1];
          const showEllipsis = prev !== undefined && p - prev > 1;
          return (
            <span key={p} className="inline-flex items-center">
              {showEllipsis && (
                <span className="px-1 text-rezics-fg-muted">…</span>
              )}
              <Button
                type="button"
                variant={p === page ? "default" : "ghost"}
                size="icon"
                onClick={() => go(p)}
              >
                {p}
              </Button>
            </span>
          );
        })}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="下一页"
          disabled={page >= visibleTotal}
          onClick={() => go(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="最后一页"
          disabled={page >= visibleTotal}
          onClick={() => go(visibleTotal)}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
      <div className="text-sm text-gray-500 text-center">
        {t("search.pagination.tips")}
      </div>
    </div>
  );
};

interface UniversalPaginatorProps<T> extends SortControlsProps {
  ref: React.Ref<UniversalPaginatorHandle>;
  data: T[];
  totalExternalItems: number;
  itemsPerPage?: number;
  externalItemsPerPage?: number;
  /**
   *
   * @param externalPage - the page number need to query
   * @returns
   */
  requestData: (externalPage: number) => void;
  preRequestData?: (page: number) => Promise<number | undefined>;
  children: (currentPageItems: T[]) => React.ReactNode;
  disableSortControl?: boolean;
  sortControl?: React.ReactElement<SortControlsProps>;
  isLoading?: boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

export type UniversalPaginatorHandle = {
  resetPaginationPageNumber: () => void;
};

/**
 * UniversalPaginator
 * @param {UniversalPaginatorProps<T>} props
 * @returns {React.ReactNode}
 * @todo Add an option to keep the page scrolled to the bottom to prevent it from jumping to the top when new data loads.
 */
export const UniversalPaginator = <T,>({
  ref,
  data,
  totalExternalItems,
  itemsPerPage = 30,
  externalItemsPerPage = 100,
  sortType,
  sortOrder,
  onSortChange,
  requestData,
  preRequestData,
  children,
  disableSortControl = false,
  sortControl,
  isLoading = false,
  currentPage = 1,
  setCurrentPage,
}: UniversalPaginatorProps<T>) => {
  const [paginationPageNumber, setPaginationPageNumber] = useState<number>(
    externalItemsPerPage / itemsPerPage,
  );
  useEffect(() => {
    console.log("paginationPageNumber", paginationPageNumber);
  }, [paginationPageNumber]);
  const internalPagesPerExternalPage = useMemo(
    () => Math.ceil(externalItemsPerPage / itemsPerPage),
    [externalItemsPerPage, itemsPerPage],
  );
  const externalPage = useMemo(
    () => Math.ceil(currentPage / internalPagesPerExternalPage),
    [currentPage, internalPagesPerExternalPage],
  );
  const rangeStartPage = useMemo(
    () => (externalPage - 1) * internalPagesPerExternalPage + 1,
    [externalPage, internalPagesPerExternalPage],
  );
  const globalStartIndex = useMemo(
    () =>
      (currentPage - rangeStartPage) * itemsPerPage +
      (externalPage - 1) * externalItemsPerPage,
    [
      currentPage,
      rangeStartPage,
      itemsPerPage,
      externalPage,
      externalItemsPerPage,
    ],
  );

  useImperativeHandle(ref, () => ({
    async resetPaginationPageNumber() {
      console.log("resetPaginationPageNumber");
      const result = await preRequestData?.(1);
      if (result) {
        const nextPaginationPageNumber =
          externalPage * Math.ceil(externalItemsPerPage / itemsPerPage);
        const dataMaxPageNumber = Math.ceil(result / itemsPerPage);
        setPaginationPageNumber(
          Math.min(dataMaxPageNumber, nextPaginationPageNumber),
        );
        console.log(
          "resetPaginationPageNumber",
          JSON.stringify({
            result: result,
            externalPage: externalPage,
            externalItemsPerPage: externalItemsPerPage,
            itemsPerPage: itemsPerPage,
            dataMaxPageNumber: dataMaxPageNumber,
            nextPaginationPageNumber: nextPaginationPageNumber,
          }),
        );
        handlePageChange(null as any, 1);
      }
    },
  }));

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalExternalItems / itemsPerPage)),
    [totalExternalItems, itemsPerPage],
  );

  const currentPageItems = useMemo(() => {
    const startIndex = (currentPage - rangeStartPage) * itemsPerPage;
    console.log(
      "currentPageItems",
      "currentPage",
      currentPage,
      "globalStartIndex",
      globalStartIndex,
      "externalPage",
      externalPage,
      "data.length",
      data.length,
    );
    console.log(
      "rangeStartPage",
      rangeStartPage,
      "startIndex",
      startIndex,
      "endIndex",
      startIndex + itemsPerPage - 1,
    );
    return data.slice(startIndex, startIndex + itemsPerPage); // no minus 1, because slice is not inclusive
  }, [
    data,
    currentPage,
    itemsPerPage,
    rangeStartPage,
    globalStartIndex,
    externalPage,
  ]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, newPage: number) => {
    console.log(
      "pageChange",
      JSON.stringify({
        newPage: newPage,
        paginationPageNumber: paginationPageNumber,
        rangeStartPage: rangeStartPage,
        globalStartIndex: globalStartIndex,
        internalPagesPerExternalPage: internalPagesPerExternalPage,
        externalPage: externalPage,
      }),
    );
    requestData(Math.ceil(newPage / internalPagesPerExternalPage));
    setCurrentPage(newPage);
    const isTheLastPage = () => {
      return newPage >= paginationPageNumber;
    };
    if (isTheLastPage()) {
      const externalPage = Math.ceil(newPage / internalPagesPerExternalPage);
      console.log("handlePageChange");
      preRequestData?.(externalPage + 1).then((result) => {
        console.log("preRequestData", result);
        if (result) {
          const nextPaginationPageNumber =
            externalPage * Math.ceil(externalItemsPerPage / itemsPerPage) +
            Math.ceil(result / itemsPerPage);
          setPaginationPageNumber(
            Math.max(paginationPageNumber, nextPaginationPageNumber),
          );
        }
      });
    }
  };

  return (
    <div>
      {!disableSortControl &&
        (sortControl || (
          <SortControls
            sortType={sortType}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
          />
        ))}

      <div className="min-h-[300px] relative">
        {isLoading && (
          <div className="absolute top-0 left-0 w-full h-1 overflow-hidden rounded-sm bg-rezics-color-info/20">
            <div className="h-full w-1/3 bg-rezics-color-info animate-[indeterminate_1.4s_ease-in-out_infinite]" />
          </div>
        )}
        {children(currentPageItems)}
        {!isLoading && currentPageItems.length === 0 && (
          <p className="text-center p-5">没有内容。</p>
        )}
      </div>
      <PaginationBar
        page={currentPage}
        dataLength={paginationPageNumber}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
};
