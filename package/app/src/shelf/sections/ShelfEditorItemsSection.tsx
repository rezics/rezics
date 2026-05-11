import { useHydratedShelfItems } from "@rezics/api/shelf";
import type { ShelfSortMode, ShelfView } from "@rezics/api/shelf";
import type { ShelfDTO } from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UnitPicker, type Candidate } from "@/unit";
import type { ShelfItemKind } from "@rezics/contract";
import { CrossPageMoveModal } from "../components/CrossPageMoveModal";
import { ShelfEditorItemRow } from "../components/ShelfEditorItemRow";
import { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { deriveShelfStream, type ShelfStreamEntry } from "../models/shelfStream";

const PAGE_SIZE = 20;

interface ShelfEditorItemsSectionProps {
  shelf: ShelfDTO;
  viewMode: ShelfView;
  editor: ReturnType<typeof useShelfItemsEditor>;
}

const SORT_OPTIONS: { value: ShelfSortMode; label: string }[] = [
  { value: "manual", label: "Position" },
  { value: "time", label: "Time" },
  { value: "title", label: "Title" },
];

function candidateKindToShelfItemKind(kind: string): ShelfItemKind {
  switch (kind) {
    case "book":
      return "book";
    case "post":
      return "post";
    case "review":
      return "review";
    case "shelf":
      return "shelf";
    case "tag":
      return "tag";
    default:
      return "post";
  }
}

function entryItemRef(entry: ShelfStreamEntry): string {
  if (entry.kind === "prime") return entry.enriched.item.itemRef;
  if (entry.kind === "review") return entry.review.unitId;
  return entry.tag.unitId;
}

export function ShelfEditorItemsSection({
  shelf,
  viewMode,
  editor,
}: ShelfEditorItemsSectionProps) {
  const { t } = useTranslation();
  const hydration = useHydratedShelfItems(editor.items);
  const [sortMode, setSortMode] = useState<ShelfSortMode>("manual");
  const [page, setPage] = useState(1);
  const [moveTargetRef, setMoveTargetRef] = useState<string | null>(null);

  const stream = useMemo(
    () => deriveShelfStream(hydration.enriched, viewMode, sortMode, true),
    [hydration.enriched, viewMode, sortMode],
  );

  const totalPages = Math.max(1, Math.ceil(stream.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStream = stream.slice(pageStart, pageStart + PAGE_SIZE);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const isPositionSort = sortMode === "manual";

  function handleAddCandidate(candidate: Candidate) {
    editor.enqueueAdd({
      itemRef: candidate.identifier,
      kind: candidateKindToShelfItemKind(String(candidate.kind)),
    });
  }

  function handleDelete(itemRef: string) {
    editor.enqueueDelete(itemRef);
  }

  function handleMoveOpen(itemRef: string) {
    setMoveTargetRef(itemRef);
  }

  function handleMovePick(toPage: number) {
    if (moveTargetRef) {
      editor.enqueueCrossPageMove(moveTargetRef, toPage);
    }
    setMoveTargetRef(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleStream.findIndex(
      (e) => entryItemRef(e) === active.id,
    );
    const newIndex = visibleStream.findIndex(
      (e) => entryItemRef(e) === over.id,
    );
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...visibleStream];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    const prev = newIndex > 0 ? reordered[newIndex - 1] : undefined;
    const next =
      newIndex < reordered.length - 1 ? reordered[newIndex + 1] : undefined;
    const before =
      prev && prev.kind === "prime" ? prev.enriched.item.position : undefined;
    const after =
      next && next.kind === "prime" ? next.enriched.item.position : undefined;

    editor.enqueueReorder(String(active.id), { before, after });
  }

  const sortableIds = visibleStream
    .filter((e) => e.kind === "prime")
    .map((e) => entryItemRef(e));

  return (
    <div className="flex flex-col gap-4">
      <hr className="border-border-whisper" />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {t("shelf.edit.items_heading", "Items")}
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-secondary">
            {t("shelf.edit.sort_by", "Sort")}
          </label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as ShelfSortMode)}
            className="text-sm border border-border-whisper rounded px-2 py-1 bg-transparent"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <UnitPicker
        workContextUnitId={shelf.unitId}
        renderItemAction={(candidate) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleAddCandidate(candidate)}
          >
            {t("shelf.edit.add", "Add")}
          </Button>
        )}
      />

      {editor.isLoading ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("common.loading", "Loading…")}
        </div>
      ) : visibleStream.length === 0 ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("shelf.edit.empty", "No items yet — add one above.")}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col">
              {visibleStream.map((entry) => {
                const ref = entryItemRef(entry);
                return (
                  <li key={ref} className="list-none">
                    <ShelfEditorItemRow
                      entry={entry}
                      rowId={ref}
                      itemRef={ref}
                      viewMode={viewMode}
                      sortable={isPositionSort && entry.kind === "prime"}
                      onDelete={handleDelete}
                      onMoveCrossPage={handleMoveOpen}
                    />
                  </li>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("common.prev", "Prev")}
          </Button>
          <span className="text-sm text-text-secondary">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t("common.next", "Next")}
          </Button>
        </div>
      )}

      <ShelfEditorItemsFooter editor={editor} />

      {editor.lastResult && editor.lastResult.failedCount > 0 && (
        <div className="rounded border border-border-error bg-error-fill/10 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>
              {editor.lastResult.failedCount} op
              {editor.lastResult.failedCount === 1 ? "" : "s"} failed.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void editor.retryFailed()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      <CrossPageMoveModal
        open={moveTargetRef !== null}
        onOpenChange={(open) => !open && setMoveTargetRef(null)}
        pageCount={totalPages}
        currentPage={page}
        onPick={handleMovePick}
      />
    </div>
  );
}

interface FooterProps {
  editor: ReturnType<typeof useShelfItemsEditor>;
}

function ShelfEditorItemsFooter({ editor }: FooterProps) {
  const { t } = useTranslation();
  if (!editor.dirty) return null;
  return (
    <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-surface-elevated border-t border-border-whisper flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={editor.discard}
        disabled={editor.saving}
      >
        {t("shelf.edit.discard_ops", "Discard ops")}
      </Button>
      <Button
        type="button"
        onClick={() => void editor.save()}
        disabled={editor.saving || editor.pendingCount === 0}
      >
        {t("shelf.edit.save_n_ops", "Save · {{n}} ops", {
          n: editor.pendingCount,
        })}
      </Button>
    </div>
  );
}
