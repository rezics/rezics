import type {
  ShelfItemKind,
  ShelfItemType,
  ShelfSortField,
  ShelfSortOrder,
} from "@rezics/api/shelf";
import {
  shelfItemStatusQuery,
  useAddShelfItemMutation,
  useAddToShelvesMutation,
  userShelvesInfiniteQuery,
} from "@rezics/api/shelf";
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
import { useSystemShelfRecoveryToast } from "../hooks/useSystemShelfRecoveryToast";
import {
  ShelfItemAnnotationPanel,
  type ShelfItemAnnotationValue,
} from "./ShelfItemAnnotationPanel";
import {
  ShelfPickerToolbar,
  type ShelfPickerSortValue,
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
 * 通用 shelf feature 入口：上方只搜尋/篩選/排序 shelf，中間固定高度虛擬列表
 * 選 shelf，下方標註被加入的 item。`form` 直接接住 dialog 高度約束。
 *
 * Mobile:
 * +----------------------+
 * | Add to shelf         |
 * | Search / Tags / Sort |
 * | [fixed shelf list]   |
 * | Annotation panel     |
 * | Cancel        Save   |
 * +----------------------+
 *
 * Tablet:
 * +--------------------------------+
 * | Add to shelf                   |
 * | Search shelf        | Sort     |
 * | [tags wrap]                    |
 * | [fixed virtual shelf list]     |
 * | Annotation panel               |
 * |                Cancel   Save   |
 * +--------------------------------+
 *
 * Desktop:
 * +------------------------------------------------+
 * | Add to shelf                                   |
 * | Search shelf                         | Sort     |
 * | [tags wrap]                                    |
 * | [fixed virtual shelf list]                     |
 * | Annotation panel                               |
 * |                            Cancel   Save       |
 * +------------------------------------------------+
 *
 * Ultra-wide:
 * +------------------------------------------------+
 * | Dialog is capped; content stretches within cap. |
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
      <DialogContent className="flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-3xl flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("entity:add_to_shelf_title")}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
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

        <DialogFooter className="shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("common:cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || selectedShelfIds.size === 0}
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
