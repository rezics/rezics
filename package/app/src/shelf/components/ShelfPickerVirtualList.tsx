import type { ShelfDTO } from "@rezics/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Checkbox } from "@rezics/ui/shadcn";
import { ListChecks } from "lucide-react";
import type { ListChildComponentProps } from "react-window";
import { FixedSizeList } from "react-window";
import { systemShelfKindLabel } from "../models/systemShelfLabel";

const ROW_HEIGHT = 72;
const LIST_HEIGHT = 288;

interface ShelfPickerVirtualListProps {
  shelves: ShelfDTO[];
  selectedShelfIds: Set<string>;
  onToggleShelf: (shelfId: string) => void;
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
  const systemKind = shelf.kindKey ? systemShelfKindLabel(shelf.kindKey) : null;
  return (
    systemKind ??
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
            {shelf.kindKey ? (
              <span className="min-w-0 truncate">{shelf.kindKey}</span>
            ) : null}
          </div>
        </div>
      </button>
    </div>
  );
}

/**
 * Fixed-height virtual shelf list.
 *
 * 列表高度固定，row 高度固定，避免 shelf 數量增長造成 dialog 撐高。窄屏時
 * row 內標題截斷，checkbox 與數字不收縮；寬屏時留白落在標題區。
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
 * | [x] Long shelf title                 12 custom |
 * | [ ] Another shelf                     4        |
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
  isLoading = false,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore,
}: ShelfPickerVirtualListProps) {
  const { t } = useTranslation(["common", "entity"]);
  const labels = {
    untitled: t("common:untitled"),
    itemCount: (count: number) => t("entity:shelf_items_count", { count }),
    selectShelf: (title: string) =>
      t("entity:shelf_picker_select_shelf", { title }),
  };

  if (isLoading) {
    return (
      <div className="flex h-[18rem] w-full items-center justify-center rounded-md bg-surface-subtle text-sm text-text-secondary">
        {t("common:loading")}
      </div>
    );
  }

  if (shelves.length === 0) {
    return (
      <div className="flex h-[18rem] w-full flex-col items-center justify-center gap-2 rounded-md bg-surface-subtle text-center text-sm text-text-secondary">
        <ListChecks className="h-5 w-5" />
        <span>{t("entity:shelf_picker_empty")}</span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="h-[18rem] w-full overflow-hidden rounded-md bg-surface-subtle">
        <FixedSizeList
          height={LIST_HEIGHT}
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
