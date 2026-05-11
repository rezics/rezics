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
import type {
  ShelfSortField,
  ShelfSortOrder,
  ShelfSortState,
  ShelfView,
} from "@rezics/api/shelf";
import { useHydratedShelfItems } from "@rezics/api/shelf";
import type { ShelfDTO, ShelfItemKind } from "@rezics/contract";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import {
  LayoutList as ViewAgendaIcon,
  List as ViewListIcon,
  LayoutGrid as ViewQuiltIcon,
  Rows3 as ViewUnitIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Candidate,
  shelfEntryToUnitCardSummary,
  UnitAddPicker,
  UnitCard,
} from "@/unit";
import { CrossPageMoveModal } from "../components/CrossPageMoveModal";
import { ShelfEditorItemRow } from "../components/ShelfEditorItemRow";
import type { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { visualReorderBounds } from "../models/positionMath";
import { canUseShelfReorder } from "../models/reorderAvailability";
import {
  deriveShelfStream,
  type ShelfStreamEntry,
} from "../models/shelfStream";

const PAGE_SIZE = 20;

interface ShelfEditorItemsSectionProps {
  shelf: ShelfDTO;
  viewMode: ShelfView;
  onViewModeChange: (viewMode: ShelfView) => void;
  editor: ReturnType<typeof useShelfItemsEditor>;
}

const SORT_FIELD_OPTIONS: { value: ShelfSortField; label: string }[] = [
  { value: "manual", label: "Position" },
  { value: "addedAt", label: "Added" },
  { value: "title", label: "Title" },
];

const SORT_ORDER_OPTIONS: { value: ShelfSortOrder; label: string }[] = [
  { value: "desc", label: "Desc" },
  { value: "asc", label: "Asc" },
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

function lastSingleToggleValue(values: readonly string[]): string | undefined {
  return values.at(-1);
}

function isShelfView(value: string | undefined): value is ShelfView {
  return (
    value === "nested" ||
    value === "flat" ||
    value === "masonry" ||
    value === "unit"
  );
}

function requireShelfSortField(value: ShelfSortField | null): ShelfSortField {
  if (value === null) {
    throw new Error("Shelf sort field select emitted null");
  }
  return value;
}

function requireShelfSortOrder(value: ShelfSortOrder | null): ShelfSortOrder {
  if (value === null) {
    throw new Error("Shelf sort order select emitted null");
  }
  return value;
}

function defaultOrderForField(field: ShelfSortField): ShelfSortOrder {
  return field === "title" ? "asc" : "desc";
}

export function ShelfEditorItemsSection({
  viewMode,
  onViewModeChange,
  editor,
}: ShelfEditorItemsSectionProps) {
  const { t } = useTranslation();
  const hydration = useHydratedShelfItems(editor.items);
  const [sortState, setSortState] = useState<ShelfSortState>({
    field: "manual",
    order: "desc",
  });
  const [page, setPage] = useState(1);
  const [moveTargetRef, setMoveTargetRef] = useState<string | null>(null);
  const [activeDragRef, setActiveDragRef] = useState<string | null>(null);

  const stream = useMemo(
    () => deriveShelfStream(hydration.enriched, viewMode, sortState, true),
    [hydration.enriched, viewMode, sortState],
  );

  const totalPages = Math.max(1, Math.ceil(stream.length / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const visibleStream = stream.slice(pageStart, pageStart + PAGE_SIZE);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  );

  const canReorder = canUseShelfReorder(viewMode, sortState);

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
      editor.enqueueCrossPageMove(
        moveTargetRef,
        toPage,
        PAGE_SIZE,
        sortState.order,
      );
    }
    setMoveTargetRef(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragRef(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragRef(null);
    if (!canReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const primeRows = visibleStream
      .filter((entry) => entry.kind === "prime")
      .map((entry) => ({
        id: entryItemRef(entry),
        position: entry.enriched.item.position,
      }));
    const oldIndex = primeRows.findIndex((entry) => entry.id === active.id);
    const newIndex = primeRows.findIndex((entry) => entry.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = [...primeRows];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved!);

    const { before, after } = visualReorderBounds(
      reordered,
      newIndex,
      sortState.order,
    );

    editor.enqueueReorder(String(active.id), { before, after });
  }

  const sortableIds = canReorder
    ? visibleStream
        .filter((e) => e.kind === "prime")
        .map((e) => entryItemRef(e))
    : [];
  const selectedSortLabel =
    SORT_FIELD_OPTIONS.find((option) => option.value === sortState.field)
      ?.label ?? SORT_FIELD_OPTIONS[0]!.label;
  const selectedOrderLabel =
    SORT_ORDER_OPTIONS.find((option) => option.value === sortState.order)
      ?.label ?? SORT_ORDER_OPTIONS[0]!.label;
  const activeDragEntry = activeDragRef
    ? visibleStream.find((entry) => entryItemRef(entry) === activeDragRef)
    : undefined;
  const nestedViewLabel = t("shelf.view_modes.nested");
  const flatViewLabel = t("shelf.view_modes.flat");
  const masonryViewLabel = t("shelf.view_modes.masonry");
  const unitViewLabel = t("shelf.view_modes.unit", "Unit cards");
  const listItems = (
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
              sortable={canReorder && entry.kind === "prime"}
              canMoveCrossPage={
                canReorder && totalPages > 1 && entry.kind === "prime"
              }
              canDelete={entry.kind === "prime"}
              showAddedAt={sortState.field === "addedAt"}
              onDelete={handleDelete}
              onMoveCrossPage={handleMoveOpen}
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

      <UnitAddPicker
        actionLabel={t("shelf.edit.add", "Add")}
        onSelectCandidate={handleAddCandidate}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-2">
          <Label className="text-sm text-text-secondary">
            {t("shelf.edit.sort_by", "Sort")}
          </Label>
          <Select<ShelfSortField>
            value={sortState.field}
            onValueChange={(value) => {
              const field = requireShelfSortField(value);
              setSortState({
                field,
                order: defaultOrderForField(field),
              });
            }}
          >
            <SelectTrigger size="sm" className="min-w-[128px]">
              <SelectValue>{selectedSortLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_FIELD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select<ShelfSortOrder>
            value={sortState.order}
            onValueChange={(value) =>
              setSortState((current) => ({
                ...current,
                order: requireShelfSortOrder(value),
              }))
            }
          >
            <SelectTrigger size="sm" className="min-w-[92px]">
              <SelectValue>{selectedOrderLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_ORDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Label className="text-sm text-text-secondary">View</Label>
          <TooltipProvider>
            <ToggleGroup
              value={[viewMode]}
              onValueChange={(values) => {
                const value = lastSingleToggleValue(values);
                if (!isShelfView(value)) return;
                onViewModeChange(value);
              }}
              size="sm"
            >
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <ToggleGroupItem
                      value="nested"
                      aria-label={nestedViewLabel}
                      {...props}
                    >
                      <ViewAgendaIcon className="h-4 w-4" />
                    </ToggleGroupItem>
                  )}
                />
                <TooltipContent side="top">{nestedViewLabel}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <ToggleGroupItem
                      value="flat"
                      aria-label={flatViewLabel}
                      {...props}
                    >
                      <ViewListIcon className="h-4 w-4" />
                    </ToggleGroupItem>
                  )}
                />
                <TooltipContent side="top">{flatViewLabel}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <ToggleGroupItem
                      value="masonry"
                      aria-label={masonryViewLabel}
                      {...props}
                    >
                      <ViewQuiltIcon className="h-4 w-4" />
                    </ToggleGroupItem>
                  )}
                />
                <TooltipContent side="top">{masonryViewLabel}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <ToggleGroupItem
                      value="unit"
                      aria-label={unitViewLabel}
                      {...props}
                    >
                      <ViewUnitIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Unit</span>
                    </ToggleGroupItem>
                  )}
                />
                <TooltipContent side="top">{unitViewLabel}</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </TooltipProvider>
        </div>
      </div>

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
          sensors={canReorder ? sensors : []}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragRef(null)}
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
                summary={shelfEntryToUnitCardSummary(activeDragEntry)}
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
