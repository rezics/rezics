import type {
  ShelfItemKind,
  ShelfItemType,
  ShelfSortField,
  ShelfSortOrder,
} from "@rezics/contract/api/shelf";
import {
  shelfItemStatusQuery,
  useAddShelfItemMutation,
  useAddToShelvesMutation,
  userShelvesInfiniteQuery,
} from "@rezics/contract/api/shelf";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/utils/css-util";
import { useMediaQuery } from "@/shared/utils/use-media-query";
import { useSystemShelfRecoveryToast } from "../hooks/useSystemShelfRecoveryToast";
import {
  ShelfItemAnnotationPanel,
  type ShelfItemAnnotationValue,
} from "./ShelfItemAnnotationPanel";
import {
  type ShelfPickerSortValue,
  ShelfPickerToolbar,
} from "./ShelfPickerToolbar";
import { ShelfPickerVirtualList } from "./ShelfPickerVirtualList";

interface AddToShelfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUnitId: string;
  variantUnitId?: string;
  targetItemType?: ShelfItemType;
  targetKind?: ShelfItemKind;
  isReview?: boolean;
}

const LIST_LIMIT = 50;

function parseSort(sort: ShelfPickerSortValue): {
  field: ShelfSortField | "createdAt" | "updatedAt" | "itemCount";
  order: ShelfSortOrder;
} {
  const [field, order] = sort.split(":");
  return {
    field: field as ShelfSortField | "createdAt" | "updatedAt" | "itemCount",
    order: order as ShelfSortOrder,
  };
}

/**
 * Add to shelf dialog.
 *
 * 通用 shelf feature 入口。窄屏或矮視口用全屏 page modal，讓整個流程像一個
 * 頁面；一般桌面用 bounded dialog，header/footer 固定，只有 shelf 結果區
 * 消化剩餘高度並滾動，避免 dialog body 與列表形成雙滾動條。
 *
 * Mobile:
 * +----------------------+
 * | Header               |
 * | Search / Tags / Sort |
 * | Shelf results        |
 * | Annotation panel     |
 * | Footer actions       |
 * +----------------------+
 *
 * Tablet:
 * +--------------------------------+
 * | Header                         |
 * | Search shelf        | Sort     |
 * | [tags wrap]                    |
 * | [shelf results scroll]         |
 * | Annotation panel               |
 * | Footer actions                 |
 * +--------------------------------+
 *
 * Desktop:
 * +------------------------------------------------+
 * | Header                                         |
 * | Search shelf                         | Sort     |
 * | [tags wrap]                                    |
 * | [shelf results fill remaining height]          |
 * | Annotation panel                               |
 * | Footer actions                                 |
 * +------------------------------------------------+
 *
 * Ultra-wide:
 * +------------------------------------------------+
 * | Dialog stays capped; shelf results stretch only.|
 * +------------------------------------------------+
 */
export function AddToShelfDialog({
  open,
  onOpenChange,
  targetUnitId,
  variantUnitId,
  targetItemType = "unit",
  targetKind,
  isReview = false,
}: AddToShelfDialogProps) {
  const { t } = useTranslation(["common", "entity"]);
  const isPageModal = useMediaQuery("(max-width: 639px), (max-height: 700px)");
  const [selectedShelfIds, setSelectedShelfIds] = useState<Set<string>>(
    new Set(),
  );
  const [query, setQuery] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [sort, setSort] = useState<ShelfPickerSortValue>("updatedAt:desc");
  const [independent, setIndependent] = useState(false);
  const [annotation, setAnnotation] = useState<ShelfItemAnnotationValue>({
    tagUnitIds: [],
    searchText: "",
  });

  const isUnitTarget = targetItemType === "unit";
  const statusTargetId = variantUnitId ?? targetUnitId;
  const deferredQuery = useDeferredValue(query.trim());
  const shelfFilters = useMemo(
    () => ({
      q: deferredQuery || undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      sort: parseSort(sort),
      limit: LIST_LIMIT,
    }),
    [deferredQuery, sort, tagIds],
  );
  const shelvesQuery = useInfiniteQuery({
    ...userShelvesInfiniteQuery(shelfFilters),
    enabled: open,
  });
  const statusQuery = useQuery({
    ...shelfItemStatusQuery(statusTargetId),
    enabled: isUnitTarget && open && !!statusTargetId,
  });

  const recovery = useSystemShelfRecoveryToast();
  const addToShelvesMutation = useAddToShelvesMutation({
    onError: (error) => recovery.handleError(error),
  });
  const addShelfItemMutation = useAddShelfItemMutation({
    onError: (error) => recovery.handleError(error),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: changing the target while the dialog is open must reset the draft form.
  useEffect(() => {
    if (!open) return;
    setIndependent(false);
    setAnnotation({ tagUnitIds: [], searchText: "" });
  }, [open, targetUnitId]);

  useEffect(() => {
    if (!open || !statusQuery.data?.shelves) return;
    setSelectedShelfIds(
      new Set(statusQuery.data.shelves.map((shelf) => shelf.id)),
    );
  }, [open, statusQuery.data?.shelves]);

  const shelves =
    shelvesQuery.data?.pages.flatMap((page) => page.shelves) ?? [];
  const isSaving =
    addToShelvesMutation.isPending || addShelfItemMutation.isPending;

  function toggleShelf(shelfId: string) {
    setSelectedShelfIds((current) => {
      const next = new Set(current);
      if (next.has(shelfId)) next.delete(shelfId);
      else next.add(shelfId);
      return next;
    });
  }

  async function handleSave() {
    const shelfIds = [...selectedShelfIds];
    const normalizedSearchText = annotation.searchText.trim();
    const searchText =
      normalizedSearchText.length > 0 ? normalizedSearchText : null;
    try {
      if (isUnitTarget) {
        await addToShelvesMutation.mutateAsync({
          targetId: targetUnitId,
          variantUnitId,
          shelfIds,
          independent,
          tagUnitIds: annotation.tagUnitIds,
          searchText,
        });
      } else {
        const kind = targetKind ?? targetItemType;
        await Promise.all(
          shelfIds.map((shelfId) =>
            addShelfItemMutation.mutateAsync({
              shelfId,
              input: {
                itemType: targetItemType,
                itemId: targetUnitId,
                kind,
                tagUnitIds: annotation.tagUnitIds,
                searchText,
              },
            }),
          ),
        );
      }
      onOpenChange(false);
    } catch {
      // Mutation hooks surface retry/recovery UI.
      // mutation hook 会暴露重试/恢复提示。
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-full flex-col overflow-hidden",
          isPageModal
            ? "h-[100dvh] max-h-[100dvh] max-w-none gap-0 rounded-none p-0 sm:max-w-none"
            : "h-[min(48rem,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] max-w-3xl",
        )}
      >
        <DialogHeader
          className={cn(
            "shrink-0 pr-12",
            isPageModal && "border-b border-border-whisper px-4 py-4",
          )}
        >
          <DialogTitle>{t("entity:add_to_shelf_title")}</DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-4",
            isPageModal ? "overflow-y-auto px-4 py-4" : "overflow-hidden",
          )}
        >
          <ShelfPickerToolbar
            query={query}
            onQueryChange={setQuery}
            tagIds={tagIds}
            onTagIdsChange={setTagIds}
            sort={sort}
            onSortChange={setSort}
          />
          <ShelfPickerVirtualList
            shelves={shelves}
            selectedShelfIds={selectedShelfIds}
            onToggleShelf={toggleShelf}
            fillHeight={!isPageModal}
            isLoading={shelvesQuery.isLoading || statusQuery.isLoading}
            hasMore={shelvesQuery.hasNextPage}
            isFetchingMore={shelvesQuery.isFetchingNextPage}
            onLoadMore={() => void shelvesQuery.fetchNextPage()}
          />
          <ShelfItemAnnotationPanel
            unitId={statusTargetId}
            value={annotation}
            onChange={setAnnotation}
            showIndependent={isReview}
            independent={independent}
            onIndependentChange={setIndependent}
          />
        </div>

        <DialogFooter
          className={cn(
            "shrink-0",
            isPageModal &&
              "border-t border-border-whisper bg-popover px-4 py-3",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={cn(isPageModal && "w-full sm:w-auto")}
          >
            {t("common:cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || selectedShelfIds.size === 0}
            className={cn(isPageModal && "w-full sm:w-auto")}
          >
            {isSaving
              ? t("entity:add_to_shelf_saving")
              : t("entity:add_to_shelf_save", {
                  count: selectedShelfIds.size,
                })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
