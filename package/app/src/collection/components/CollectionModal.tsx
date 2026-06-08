import { getSeedTagId } from "@rezics/api/infra/bootstrap";
import type {
  CollectionStatusResponse,
  ShelfSummaryDTO,
} from "@rezics/api/shelf";
import {
  SEED_TAG_NAMES,
  SEED_TAG_TITLES,
  type SeedTagName,
  type SystemShelfKindKey,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Separator,
  Textarea,
} from "@rezics/ui/shadcn";
import { useCallback, useMemo, useState } from "react";

interface CollectionModalProps {
  open: boolean;
  onClose: () => void;
  onCollect: (
    shelfIds: string[],
    independent?: boolean,
    searchText?: string | null,
  ) => void;
  shelves: ShelfSummaryDTO[];
  status?: CollectionStatusResponse;
  isCollecting: boolean;
  isLoading: boolean;
  isReview?: boolean;
}

// Backlog/Active/Completed are reached only via progress-status side-effects
// (`user-unit-progress` spec). Surfacing them as collectable targets in the
// modal would let users mis-route a unit through the wrong write path, so
// the modal filters them out entirely. Favorites and Saved stay as
// system-shelf collectable targets.
// Backlog/Active/Completed 只能通过进度状态的副作用到达
// （`user-unit-progress` 规范）。若在弹窗中将它们暴露为可收藏目标，
// 会让用户经由错误的写入路径误导一个 unit，因此弹窗将其完全过滤掉。
// Favorites 和 Saved 仍作为系统书架的可收藏目标保留。
const HIDDEN_SYSTEM_KIND_KEYS: ReadonlySet<SystemShelfKindKey> = new Set([
  "backlog",
  "active",
  "completed",
]);

export function CollectionModal({
  open,
  onClose,
  onCollect,
  shelves,
  status,
  isCollecting,
  isLoading,
  isReview = false,
}: CollectionModalProps) {
  const { t } = useTranslation(["common", "entity"]);
  const [selectedShelves, setSelectedShelves] = useState<Set<string>>(
    new Set(),
  );
  const [filterTag, setFilterTag] = useState<SeedTagName | null>(null);
  const [independent, setIndependent] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Initialize selected shelves from status
  // 根据 status 初始化已选中的书架
  useMemo(() => {
    if (status?.shelves) {
      setSelectedShelves(new Set(status.shelves.map((s) => s.id)));
    }
  }, [status]);

  const visibleShelves = useMemo(() => {
    return shelves.filter((s) => {
      const kk = s.kindKey;
      return !kk || !HIDDEN_SYSTEM_KIND_KEYS.has(kk as SystemShelfKindKey);
    });
  }, [shelves]);

  const filteredShelves = useMemo(() => {
    if (!filterTag) return visibleShelves;
    const tagId = getSeedTagId(filterTag);
    if (!tagId) return visibleShelves;
    return visibleShelves.filter((s) =>
      s.tags?.some((t) => t.tagUnitId === tagId),
    );
  }, [visibleShelves, filterTag]);

  const shelfDisplayTitle = useCallback(
    (shelf: ShelfSummaryDTO): string => {
      if (shelf.kindKey === "favorites") {
        return t("entity:shelf_system_favorites");
      }
      return shelf.title ?? t("common:untitled");
    },
    [t],
  );

  const toggleShelf = useCallback((shelfId: string) => {
    setSelectedShelves((prev) => {
      const next = new Set(prev);
      if (next.has(shelfId)) next.delete(shelfId);
      else next.add(shelfId);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    const normalizedSearchText = searchText.trim();
    onCollect(
      [...selectedShelves],
      independent,
      normalizedSearchText.length > 0 ? normalizedSearchText : undefined,
    );
  }, [selectedShelves, independent, searchText, onCollect]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{t("entity:collection_title")}</DialogTitle>
        </DialogHeader>
        <Separator />
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Content-type filter chips 内容类型筛选标签 */}
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={filterTag === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterTag(null)}
              >
                {t("common:all")}
              </Badge>
              {SEED_TAG_NAMES.map((name) => (
                <Badge
                  key={name}
                  variant={filterTag === name ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterTag(filterTag === name ? null : name)}
                >
                  {SEED_TAG_TITLES[name]}
                </Badge>
              ))}
            </div>

            {/* Shelf list with checkboxes 带复选框的书架列表 */}
            <ul className="flex flex-col">
              {filteredShelves.length === 0 ? (
                <p className="text-sm text-text-secondary px-2">
                  {t("entity:collection_no_shelves_found")}
                </p>
              ) : (
                filteredShelves.map((shelf) => {
                  const displayTitle = shelfDisplayTitle(shelf);
                  return (
                    <li key={shelf.unitId}>
                      {/* biome-ignore lint/a11y/noStaticElementInteractions: row click mirrors the checkbox for pointer users. */}
                      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users can toggle the checkbox directly. */}
                      <div
                        className="flex items-center gap-2 py-1 cursor-pointer"
                        onClick={() => toggleShelf(shelf.unitId)}
                      >
                        <Checkbox
                          checked={selectedShelves.has(shelf.unitId)}
                          tabIndex={-1}
                          aria-label={t("entity:collection_select_shelf", {
                            title: displayTitle,
                          })}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{displayTitle}</p>
                          <p className="text-xs text-text-secondary">
                            {t("entity:shelf_items_count", {
                              count: shelf.itemCount,
                            })}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="collection-search-text" className="text-sm">
                {t("entity:collection_search_text_label")}
              </Label>
              <Textarea
                id="collection-search-text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={t("entity:collection_search_text_placeholder")}
                rows={3}
              />
              <p className="text-xs leading-[1.4] text-text-secondary">
                {t("entity:collection_search_text_hint")}
              </p>
            </div>

            {/* Dual collection mode for reviews 评论的双重收藏模式 */}
            {isReview && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={independent}
                  onCheckedChange={(c) => setIndependent(c === true)}
                  aria-label={t("entity:collection_independent_unit")}
                />
                <span className="text-sm">
                  {t("entity:collection_independent_unit")}
                </span>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose} size="sm" variant="ghost">
            {t("common:cancel")}
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            disabled={isCollecting || selectedShelves.size === 0}
          >
            {isCollecting ? t("common:saving") : t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
