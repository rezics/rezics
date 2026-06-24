import type { ShelfDTO } from "@rezics/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Checkbox } from "@rezics/ui/shadcn";
import { ListChecks } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListChildComponentProps } from "react-window";
import { FixedSizeList } from "react-window";
import { cn } from "@/shared/utils/css-util";

const ROW_HEIGHT = 72;
const DEFAULT_LIST_HEIGHT = 288;

interface ShelfPickerVirtualListProps {
  shelves: ShelfDTO[];
  selectedShelfIds: Set<string>;
  onToggleShelf: (shelfId: string) => void;
  fillHeight?: boolean;
  isLoading?: boolean;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
}

type RowData = Pick<
  ShelfPickerVirtualListProps,
  "shelves" | "selectedShelfIds" | "onToggleShelf"
> & {
  labels: {
    untitled: string;
    itemCount: (count: number) => string;
    selectShelf: (title: string) => string;
  };
};

function shelfTitle(shelf: ShelfDTO, untitled: string): string {
  return (
    shelf.translations?.find((translation) => translation.title)?.title ??
    untitled
  );
}

function ShelfRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const shelf = data.shelves[index];
  if (!shelf) return null;
  const title = shelfTitle(shelf, data.labels.untitled);
  const checked = data.selectedShelfIds.has(shelf.unitId);
  return (
    <div style={style} className="px-1 py-1">
      <button
        type="button"
        className="flex h-full w-full min-w-0 items-center gap-3 rounded-md px-3 text-left hover:bg-surface-subtle"
        onClick={() => data.onToggleShelf(shelf.unitId)}
      >
        <Checkbox
          checked={checked}
          aria-label={data.labels.selectShelf(title)}
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-[1.4] text-text-primary">
            {title}
          </div>
          <div className="flex min-w-0 items-center gap-2 text-xs leading-[1.3] text-text-secondary">
            <span className="shrink-0">
              {data.labels.itemCount(shelf.itemCount ?? 0)}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

/**
 * Virtual shelf list.
 *
 * 預設高度固定；桌面 dialog 可切換為填滿父層剩餘高度，由 shelf 列表自己滾動，
 * 避免外層 dialog body 出現第二條滾動條。row 高度固定，窄屏時 row 內標題截斷，
 * checkbox 與數字不收縮；寬屏時留白落在標題區。
 *
 * Mobile:
 * +----------------------+
 * | [x] Long shelf... 12 |
 * | [ ] Shelf title   4  |
 * | fixed scroll area    |
 * +----------------------+
 *
 * Tablet:
 * +--------------------------------+
 * | [x] Long shelf title       12  |
 * | [ ] Another shelf          4   |
 * +--------------------------------+
 *
 * Desktop:
 * +------------------------------------------------+
 * | list fills remaining dialog height             |
 * | [x] Long shelf title                 12 custom |
 * +------------------------------------------------+
 *
 * Ultra-wide:
 * +------------------------------------------------+
 * | Width remains capped by dialog; rows stretch.   |
 * +------------------------------------------------+
 */
export function ShelfPickerVirtualList({
  shelves,
  selectedShelfIds,
  onToggleShelf,
  fillHeight = false,
  isLoading = false,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
}: ShelfPickerVirtualListProps) {
  const { t } = useTranslation(["common", "entity"]);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState(DEFAULT_LIST_HEIGHT);
  const labels = {
    untitled: t("common:untitled"),
    itemCount: (count: number) => t("entity:shelf_items_count", { count }),
    selectShelf: (title: string) =>
      t("entity:shelf_picker_select_shelf", { title }),
  };
  const viewportClassName = cn(
    "w-full overflow-hidden rounded-md bg-surface-subtle",
    fillHeight ? "min-h-[12rem] flex-1" : "h-[18rem]",
  );
  const measureViewport = useCallback((viewport: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    const updateHeight = () => {
      setMeasuredHeight(
        Math.max(ROW_HEIGHT, Math.floor(viewport.clientHeight)),
      );
    };
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(viewport);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex w-full flex-col",
          fillHeight ? "min-h-0 flex-1" : null,
        )}
      >
        <div
          ref={measureViewport}
          className={cn(
            "flex items-center justify-center text-sm text-text-secondary",
            viewportClassName,
          )}
        >
          {t("common:loading")}
        </div>
      </div>
    );
  }

  if (shelves.length === 0) {
    return (
      <div
        className={cn(
          "flex w-full flex-col",
          fillHeight ? "min-h-0 flex-1" : null,
        )}
      >
        <div
          ref={measureViewport}
          className={cn(
            "flex flex-col items-center justify-center gap-2 text-center text-sm text-text-secondary",
            viewportClassName,
          )}
        >
          <ListChecks className="h-5 w-5" />
          <span>{t("entity:shelf_picker_empty")}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        fillHeight ? "min-h-0 flex-1" : null,
      )}
    >
      <div ref={measureViewport} className={viewportClassName}>
        <FixedSizeList
          height={measuredHeight}
          itemCount={shelves.length}
          itemSize={ROW_HEIGHT}
          width="100%"
          itemData={{ shelves, selectedShelfIds, onToggleShelf, labels }}
        >
          {ShelfRow}
        </FixedSizeList>
      </div>
      {hasMore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLoadMore}
          disabled={isFetchingMore}
          className="w-full"
        >
          {isFetchingMore ? t("common:loading") : t("common:load_more")}
        </Button>
      ) : null}
    </div>
  );
}
