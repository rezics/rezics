import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { ShelfSortState, ShelfView } from "@rezics/api/shelf";
import { useHydratedShelfUnits } from "@rezics/api/shelf";
import type { ShelfDTO, ShelfUnitKind } from "@rezics/contract";
import {
  Button,
  Checkbox,
  Label,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { Eye, ListChecks, Pencil } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Candidate,
  shelfUnitToUnitCardSummary,
  UnitAddPicker,
  UnitCard,
} from "@/unit";
import { CrossPageMoveModal } from "../components/CrossPageMoveModal";
import { ShelfEditorItemRow } from "../components/ShelfEditorItemRow";
import { ShelfItemRenderer } from "../components/ShelfItemRenderer";
import {
  type ShelfSortChoice,
  ShelfSortViewPicker,
  type ShelfViewChoice,
} from "../components/ShelfSortViewPicker";
import type { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { visualReorderBounds } from "../models/positionMath";
import {
  canReorderShelfStreamEntry,
  canUseShelfReorder,
} from "../models/reorderAvailability";
import {
  deriveShelfStream,
  type ShelfStreamEntry,
} from "../models/shelfStream";

const PAGE_SIZE = 20;

type EditorMode = "edit" | "multi-select" | "preview";

interface ShelfEditorItemsSectionProps {
  shelf: ShelfDTO;
  viewMode: ShelfView;
  onViewModeChange: (viewMode: ShelfView) => void;
  editor: ReturnType<typeof useShelfItemsEditor>;
}

const SORT_OPTIONS: ShelfSortChoice[] = [
  { field: "manual", order: "desc", label: "Manual" },
  { field: "manual", order: "asc", label: "Manual reversed" },
  { field: "addedAt", order: "desc", label: "Newest" },
  { field: "addedAt", order: "asc", label: "Oldest" },
  { field: "title", order: "asc", label: "Title A-Z" },
  { field: "title", order: "desc", label: "Title Z-A" },
];

const VIEW_OPTIONS: ShelfViewChoice<"nested" | "flat">[] = [
  { value: "nested", label: "Nested" },
  { value: "flat", label: "List" },
];

function candidateKindToShelfUnitKind(kind: string): ShelfUnitKind {
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

function entryUnitId(entry: ShelfStreamEntry): string {
  return entry.unit.unit.unitId;
}

function streamEntryRowId(entry: ShelfStreamEntry): string {
  if (entry.kind === "child") {
    return `${entry.parentUnitId}:${entry.unit.unit.unitId}`;
  }
  return entry.unit.unit.unitId;
}

function lastSingleToggleValue(values: readonly string[]): string | undefined {
  return values.at(-1);
}

function isEditorMode(value: string | undefined): value is EditorMode {
  return value === "edit" || value === "multi-select" || value === "preview";
}

export function ShelfEditorItemsSection({
  shelf,
  viewMode,
  onViewModeChange,
  editor,
}: ShelfEditorItemsSectionProps) {
  const { t } = useTranslation();
  const hydration = useHydratedShelfUnits(editor.units);
  const [sortState, setSortState] = useState<ShelfSortState>({
    field: "manual",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("edit");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [sortPrimeOnly, setSortPrimeOnly] = useState(true);
  const sortPrimeOnlyId = useId();

  useEffect(() => {
    if (mode !== "multi-select" && selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  }, [mode, selectedIds.size]);

  const stream = useMemo(
    () =>
      deriveShelfStream(
        hydration.enriched,
        editor.relations,
        viewMode,
        sortState,
        sortPrimeOnly,
      ),
    [hydration.enriched, editor.relations, viewMode, sortState, sortPrimeOnly],
  );

  const totalItemCount = Math.max(stream.length, shelf.itemCount ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItemCount / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStream = stream.slice(pageStart, pageStart + PAGE_SIZE);
  const waitingForPageData =
    editor.hasMoreUnits && pageStart >= stream.length && stream.length > 0;

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const canReorder = canUseShelfReorder(mode === "edit", sortState);
  const showSortPrimeOnlyToggle =
    viewMode === "flat" && sortState.field !== "manual";

  function handleAddCandidate(candidate: Candidate) {
    editor.enqueueAdd({
      unitId: candidate.identifier,
      kind: candidateKindToShelfUnitKind(String(candidate.kind)),
    });
  }

  function handleDelete(unitId: string) {
    editor.enqueueDelete(unitId);
  }

  function handleToggleSelected(unitId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function handleBulkDelete() {
    for (const id of selectedIds) {
      editor.enqueueDelete(id);
    }
    setSelectedIds(new Set());
  }

  function handleMoveOpen(unitId: string) {
    setMoveTargetId(unitId);
  }

  function handleMovePick(toPage: number) {
    if (moveTargetId) {
      editor.enqueueCrossPageMove(
        moveTargetId,
        toPage,
        PAGE_SIZE,
        sortState.order,
      );
    }
    setMoveTargetId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    if (!canReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sortableRows = visibleStream
      .filter((entry) =>
        canReorderShelfStreamEntry(true, sortState, viewMode, entry),
      )
      .map((entry) => ({
        id: streamEntryRowId(entry),
        unitId: entryUnitId(entry),
        position: entry.unit.unit.position,
      }));
    const oldIndex = sortableRows.findIndex((entry) => entry.id === active.id);
    const newIndex = sortableRows.findIndex((entry) => entry.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...sortableRows];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    const { before, after } = visualReorderBounds(
      reordered,
      newIndex,
      sortState.order,
    );

    editor.enqueueReorder(moved!.unitId, { before, after });
  }

  const sortableIds = canReorder
    ? visibleStream
        .filter((entry) =>
          canReorderShelfStreamEntry(true, sortState, viewMode, entry),
        )
        .map((entry) => streamEntryRowId(entry))
    : [];
  const activeDragEntry = activeDragId
    ? visibleStream.find((entry) => streamEntryRowId(entry) === activeDragId)
    : undefined;
  const editModeLabel = t("shelf.edit.mode_edit", "Edit");
  const multiSelectModeLabel = t("shelf.edit.mode_multi_select", "Select");
  const previewModeLabel = t("shelf.edit.mode_preview", "Preview");
  const isPreview = mode === "preview";
  const isMultiSelect = mode === "multi-select";
  const listItems = (
    <ul className="flex flex-col">
      {visibleStream.map((entry) => {
        const id = entryUnitId(entry);
        const rowId = streamEntryRowId(entry);
        const canEditEntryOrder = canReorderShelfStreamEntry(
          mode === "edit",
          sortState,
          viewMode,
          entry,
        );
        if (isPreview) {
          return (
            <li key={rowId} className="list-none py-1">
              <ShelfItemRenderer entry={entry} viewMode={viewMode} />
            </li>
          );
        }
        return (
          <li key={rowId} className="list-none">
            <ShelfEditorItemRow
              entry={entry}
              rowId={rowId}
              unitId={id}
              viewMode={viewMode}
              sortable={canEditEntryOrder}
              canMoveCrossPage={
                !isMultiSelect &&
                canEditEntryOrder &&
                totalPages > 1 &&
                mode === "edit"
              }
              canDelete={!isMultiSelect && canEditEntryOrder}
              onDelete={handleDelete}
              onMoveCrossPage={handleMoveOpen}
              multiSelect={isMultiSelect}
              selected={selectedIds.has(id)}
              onToggleSelected={handleToggleSelected}
            />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex flex-col gap-4">
      <hr className="border-border-whisper" />
      <h2 className="text-lg font-semibold">
        {t("shelf.edit.items_heading", "Items")}
      </h2>

      {mode === "edit" && (
        <UnitAddPicker
          actionLabel={t("shelf.edit.add", "Add")}
          onSelectCandidate={handleAddCandidate}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ShelfSortViewPicker
            sort={sortState}
            sortOptions={SORT_OPTIONS}
            view={viewMode === "masonry" ? "nested" : viewMode}
            viewOptions={VIEW_OPTIONS}
            onSortChange={setSortState}
            onViewChange={onViewModeChange}
            sortHeading={t("shelf.controls.sort_by", "Sort by")}
            viewHeading={t("shelf.controls.view", "View")}
          />
          {showSortPrimeOnlyToggle && (
            <Label
              htmlFor={sortPrimeOnlyId}
              className="flex items-center gap-2 text-sm text-text-secondary"
            >
              <Checkbox
                id={sortPrimeOnlyId}
                checked={sortPrimeOnly}
                onCheckedChange={(next) => setSortPrimeOnly(Boolean(next))}
              />
              {t("shelf.edit.sort_prime_only", "Group attached")}
            </Label>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {isMultiSelect && selectedIds.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              {t("shelf.edit.delete_selected", "Delete {{n}}", {
                n: selectedIds.size,
              })}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-text-secondary">Mode</Label>
            <TooltipProvider>
              <ToggleGroup
                value={[mode]}
                onValueChange={(values) => {
                  const value = lastSingleToggleValue(values);
                  if (!isEditorMode(value)) return;
                  setMode(value);
                }}
                size="sm"
              >
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="edit"
                        aria-label={editModeLabel}
                        {...props}
                      >
                        <Pencil className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">{editModeLabel}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="multi-select"
                        aria-label={multiSelectModeLabel}
                        {...props}
                      >
                        <ListChecks className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">
                    {multiSelectModeLabel}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <ToggleGroupItem
                        value="preview"
                        aria-label={previewModeLabel}
                        {...props}
                      >
                        <Eye className="h-4 w-4" />
                      </ToggleGroupItem>
                    )}
                  />
                  <TooltipContent side="top">{previewModeLabel}</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {editor.isLoading ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("common.loading", "Loading…")}
        </div>
      ) : waitingForPageData || editor.isLoadingMoreUnits ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("common.loading", "Loading…")}
        </div>
      ) : visibleStream.length === 0 ? (
        <div className="py-4 text-sm text-text-secondary">
          {t("shelf.edit.empty", "No items yet — add one above.")}
        </div>
      ) : (
        <DndContext
          sensors={canReorder ? sensors : []}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {listItems}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeDragEntry ? (
              <UnitCard
                summary={shelfUnitToUnitCardSummary(
                  activeDragEntry.unit.unit,
                  activeDragEntry.unit.data,
                )}
                className="bg-surface-elevated"
              />
            ) : null}
          </DragOverlay>
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
        open={moveTargetId !== null}
        onOpenChange={(open) => !open && setMoveTargetId(null)}
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
