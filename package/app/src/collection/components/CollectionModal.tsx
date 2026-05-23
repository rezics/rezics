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
import * as m from "@rezics/i18n/messages";
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
  Separator,
} from "@rezics/ui/shadcn";
import { useCallback, useMemo, useState } from "react";

// Backlog/Active/Completed are reached only via progress-status side-effects
// (`user-unit-progress` spec). Surfacing them as collectable targets in the
// modal would let users mis-route a unit through the wrong write path, so
// the modal filters them out entirely. Favorites stays as the one
// system-shelf collectable target.
const HIDDEN_SYSTEM_KIND_KEYS: ReadonlySet<SystemShelfKindKey> = new Set([
  "backlog",
  "active",
  "completed",
]);

interface CollectionModalProps {
  open: boolean;
  onClose: () => void;
  onCollect: (shelfIds: string[], independent?: boolean) => void;
  shelves: ShelfSummaryDTO[];
  status?: CollectionStatusResponse;
  isCollecting: boolean;
  isLoading: boolean;
  isReview?: boolean;
}

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
  const [selectedShelves, setSelectedShelves] = useState<Set<string>>(
    new Set(),
  );
  const [filterTag, setFilterTag] = useState<SeedTagName | null>(null);
  const [independent, setIndependent] = useState(false);

  // Initialize selected shelves from status
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

  const shelfDisplayTitle = useCallback((shelf: ShelfSummaryDTO): string => {
    if (shelf.kindKey === "favorites") {
      return m.shelf_system_favorites();
    }
    return shelf.title ?? m.common_untitled();
  }, []);

  const toggleShelf = useCallback((shelfId: string) => {
    setSelectedShelves((prev) => {
      const next = new Set(prev);
      if (next.has(shelfId)) next.delete(shelfId);
      else next.add(shelfId);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    onCollect([...selectedShelves], independent);
  }, [selectedShelves, independent, onCollect]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{m.collection_title()}</DialogTitle>
        </DialogHeader>
        <Separator />
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Content-type filter chips */}
            <div className="flex flex-wrap gap-1">
              <Badge
                variant={filterTag === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilterTag(null)}
              >
                {m.common_all()}
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

            {/* Shelf list with checkboxes */}
            <ul className="flex flex-col">
              {filteredShelves.length === 0 ? (
                <p className="text-sm text-text-secondary px-2">
                  {m.collection_no_shelves_found()}
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
                          aria-label={m.collection_select_shelf({
                            title: displayTitle,
                          })}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{displayTitle}</p>
                          <p className="text-xs text-text-secondary">
                            {m.shelf_items_count({ count: shelf.itemCount })}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Dual collection mode for reviews */}
            {isReview && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={independent}
                  onCheckedChange={(c) => setIndependent(c === true)}
                  aria-label={m.collection_independent_unit()}
                />
                <span className="text-sm">
                  {m.collection_independent_unit()}
                </span>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose} size="sm" variant="ghost">
            {m.common_cancel()}
          </Button>
          <Button
            onClick={handleSave}
            size="sm"
            disabled={isCollecting || selectedShelves.size === 0}
          >
            {isCollecting ? m.common_saving() : m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
